/*--- IMPORTACION DE MODULOS --- */
const { OPCUAServer, DataType, nodesets,StatusCodes, Variant } = require("node-opcua");
const chalk = require("chalk");
const SerialPort = require('serialport');
// const raspi = require('raspi');
// const I2C = require('raspi-i2c').I2C;

/* --- VARIABLES GLOBALES --- */
PosX = ''; PosY = ''; PosZ = '';
Tb = ''; Te = '';    // Tb: temperatura base, Te: temperatura extrusor
strdata = '';
const I4AAS = "Opc.Ua.I4AAS.NodeSet2.xml"

/* --- ACCESO DE USUARIOS --- */
const userManager = {
    isValidUser: function(userName, password) {
  
      if (userName === "julian" && password === "1234") {
        return true;
      }
      if (userName === "user2" && password === "password2") {
        return true;
      }
      return false;
    }
};

/* --- SERVIDOR UA ASINCRONO --- */
(async () => {
    try {
        /* --- PARAMETROS DEL SERVIDOR --- */
        const server = new OPCUAServer({
            /* --- ESPECIFICASIONES UA --- */
            nodeset_filename: [
                nodesets.standard, nodesets.cnc, nodesets.di, I4AAS
            ],
            serverInfo: {
                applicationName: { text: "Servidor ImpresoraFDM", locale: "es" },
            },
            userManager: userManager,
            port: 4334, // puerto del servidor
            resourcePath: "/UA/ImpresoraServer", // this path will be added to the endpoint resource name
            buildInfo : {
                productName: "ServidorImpresorasFDM",
                buildNumber: "7658",
                buildDate: new Date(2021,1,16)
            }
        });

        /* --- CONSTRUCCION DEL ESPACIO DE DIRECCIONES ---*/
        await server.initialize();
        const addressSpace = server.engine.addressSpace;    // generar addressSpace inicial
        const nsCnc = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CNC");    // NS DEL CNC(URI)
        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");    // NS DE DI(URI)
        const nsAAS = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/I4AAS/");    // NS DE I4AAS(URI)
        const namespace = addressSpace.getOwnNamespace("http://opcfoundation.org/UA/");   // Crear nuestro namespace(NS) 

        /* --- BUSCAR OBJECTYPES A INSTANCIAR --- */
        const CncInterfaceType = addressSpace.findObjectType("CncInterfaceType",nsCnc);
        const CncAxisType = addressSpace.findObjectType("CncAxisType",nsCnc);
        const AASAssetAdministrationShellType = addressSpace.findObjectType("AASAssetAdministrationShellType",nsAAS);
        const AASReferenceType = addressSpace.findObjectType("AASReferenceType",nsAAS);
        const AASSubmodelType = addressSpace.findObjectType("AASSubmodelType",nsAAS);
        const AASConceptDictionaryType = addressSpace.findObjectType("AASConceptDictionaryType",nsAAS);
        const IAASIdentifiableType = addressSpace.findObjectType("IAASIdentifiableType",nsAAS);
        const AASIdentifierType = addressSpace.findObjectType("AASIdentifierType",nsAAS);
        const AASFileType = addressSpace.findObjectType("AASFileType",nsAAS);
        const AASSubmodelElementCollectionType = addressSpace.findObjectType("AASSubmodelElementCollectionType",nsAAS);
        const FileType = addressSpace.findObjectType("FileType", 0);
        
        /* --- BUSCAR nodos A INSTANCIAR --- */
        const AssetId = addressSpace.findNode("ns=3;i=15049",nsDI);
        const Manufacturer = addressSpace.findNode("ns=3;i=15036",nsDI);
        const ManufacturerUri = addressSpace.findNode("ns=3;i=15037",nsDI);
        const Model = addressSpace.findNode("ns=3;i=15038",nsDI);
        const SerialNumber = addressSpace.findNode("ns=3;i=15045",nsDI);
        const SoftwareRevision = addressSpace.findNode("ns=3;i=15040",nsDI);
        const DerivedFrom = addressSpace.findNode("ns=4;i=5007",nsAAS);
        const Name = addressSpace.findNode("ns=4;i=6066",nsAAS);
        const ShortName = Name.clone()
        
        /* --- ESPACIO PARA INSTANCIAR, CREAR Y MAPEAR (OBJETOS, VARIABLES, METODOS) --- */
        
        /* --- ESTRUCTURACION DEL AAS ---*/
        const AASROOT = namespace.addFolder(addressSpace.rootFolder.objects,{
            browseName: "AASROOT"
        });
        const AAS = AASAssetAdministrationShellType.instantiate({
            browseName: "AssetAdministrationShell:Impresora3D",
            organizedBy: AASROOT, 
        });
        AAS.addReference({referenceType: "HasComponent", nodeId: DerivedFrom.clone()});
        AAS.addReference({referenceType: "HasProperty", nodeId: ShortName});
        AAS.addReference({referenceType: "HasInterface",nodeId: IAASIdentifiableType});

        const Asset = addressSpace.findNode("ns=1;i=1003")
        const Identification = AASIdentifierType.instantiate({
            browseName: "Identification",
            organizedBy: Asset
        })
        const AssetIdentificationModel = AASReferenceType.instantiate({
            browseName: "AssetIdentificationModel",
            componentOf: Asset
        });
        const AASSubmodelID = AASSubmodelType.instantiate({
            browseName: "Submodel:Identification",
            componentOf: AAS,
        });
        const AASReference = addressSpace.findReferenceType("ns=4;i=4003",nsAAS)
        AssetIdentificationModel.addReference({referenceType: AASReference, nodeId: AASSubmodelID})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: AssetId.clone()})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: Manufacturer.clone()})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: ManufacturerUri.clone()})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: Model.clone()})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: SerialNumber.clone()})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: SoftwareRevision.clone()})

        const AASSubmodelDoc = AASSubmodelType.instantiate({
            browseName: "Submodel:Document",
            componentOf: AAS,
        });
        const OperationManual = AASSubmodelElementCollectionType.instantiate({
            browseName: "OperationManual",
            componentOf: AASSubmodelDoc
        })
        const AASfile = AASFileType.instantiate({
            browseName: "DigitalFile_PDF",
            componentOf: OperationManual
        });
        const File = FileType.instantiate({
            browseName: "File",
            componentOf: AASfile
        })
        const AASConceptDictionary = AASConceptDictionaryType.instantiate({
            browseName: "AASConceptDictionary",
            componentOf: AAS,
        });

        /* --- SUBMODELO CNC ---*/ 
        const opc40502 = CncInterfaceType.instantiate({
            browseName: "Submodel:OperationalData",
            componentOf: AAS,
        });
        
        const CncAxisList = addressSpace.findNode("ns=1;i=1052");   // nivel inferior del CncInterface instanciado
        const CncAxisExtrusor = CncAxisType.instantiate({
            browseName: "Eje Extrusor",
            componentOf: CncAxisList,
        });
        const CncAxisX = CncAxisType.instantiate({
            browseName: "Eje X",
            componentOf: CncAxisList,
        });
        const CncAxisY = CncAxisType.instantiate({
            browseName: "Eje Y",
            componentOf: CncAxisList,
        });
        const CncAxisZ = CncAxisType.instantiate({
            browseName: "Eje Z",
            componentOf: CncAxisList,
        });

        /* --- VARIABLES ADICIONALES --- */
        const TempBase = namespace.addVariable({
            componentOf: opc40502,
            browseName: "T base",
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: Tb })
            },
        });
        const TempExtr = namespace.addVariable({
            componentOf: opc40502,
            browseName: "T extrusor",
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: Te })
            },
        });

        /* --- BUSCAR NODOS A MAPEAR --- */
        /* --- Submodelo cnc --- */
        const ActPosX = addressSpace.findNode("ns=1;i=1103");
        const ActPosY = addressSpace.findNode("ns=1;i=1137");
        const ActPosZ = addressSpace.findNode("ns=1;i=1171");
        /* --- Submodelo I4AAS --- */
        const AssetKind = addressSpace.findNode("ns=1;i=1004");
        const Id = addressSpace.findNode("ns=1;i=1008");
        const IdType = addressSpace.findNode("ns=1;i=1009");
        const Keys = addressSpace.findNode("ns=1;i=1011");
        const MimeType = addressSpace.findNode("ns=1;i=1026");
        const Value = addressSpace.findNode("ns=1;i=1027");
        const Size = addressSpace.findNode("ns=1;i=1031");


        /* --- MAPEAR VARIABLES --- */
        /* --- mapeo unico ---*/
        AssetKind.setValueFromSource({ dataType: "Int32", value:1});      
        Id.setValueFromSource({ dataType: "String", value: "Ej: http://customer.com/assets/KHBVZJSQKIY"});
        IdType.setValueFromSource({ dataType: "Int32", value:1});
        Keys.setValueFromSource({ dataType: "String" , value: "(Submodel)(local)[IRI]i40.customer.com/Type/1/1/F13EB576F648B342"})
        Value.setValueFromSource({ dataType: "String", value: "creality-ender-3-3d-printer-manual.pdf"})
        MimeType.setValueFromSource({ dataType: "String", value: "application/pdf"})
        Size.setValueFromSource({dataType: "UInt64", value: 828480})
        // ShortName.setValueFromSource({dataType: "String", value: "ES;Impresora3D"})

        /* --- mapeo actualizable ---*/
        setInterval(() => {
            ActPosX.setValueFromSource({dataType: "Double", value: PosX})
            ActPosY.setValueFromSource({dataType: "Double", value: PosY})
            ActPosZ.setValueFromSource({dataType: "Double", value: PosZ})
        }, 500);

        /* --- CREAR METODOS ---*/
        const method = namespace.addMethod(opc40502,{
            browseName: "Write Serial",
            inputArguments:  [
                {
                    name:"Gcode, Mcode",
                    description: { text: "Escribir codigo a enviar" },
                    dataType: DataType.String
                }
            ],
            outputArguments: [{
                name:"Confirmacion",
                description:{ text: "Confirmar envio" },
                dataType: DataType.String ,
            }]
        });
        method.bindMethod((inputArguments,context,callback) => {
            const inCode =  inputArguments[0].value;
            mySerial.write(inCode);
            const callMethodResult = {
                statusCode: StatusCodes.Good,
                outputArguments: [{
                        dataType: DataType.String,
                        value : "Codigo enviado"
                }]
            };
            callback(null,callMethodResult);
            console.log(inCode);
        });
        
        /* --- ESPERAR CONFIGURACION DEL SERVIDOR PARA COMENZAR A EXPONERSE ---*/
        await server.start();
        const endpointUrl = server.getEndpointUrl();  // obtener informacion del punto de acceso

        /* --- MOSTRAR INFORMACION DEL SERVIDOR --- */
        console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));
        console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

        /* --- PROCESO DE SALIDA O PARADA DEL SERVIDOR --- */
        process.on("SIGINT", async () => {
            // only work on linux apparently
            await server.shutdown(1000);
            console.log(chalk.red.bold(" shutting down completed "));
            process.exit(-1);
        });
    }
    catch(err){
        /* --- CODIGO DE EJECUCION SI OCURRE UN ERROR EN EL BLOQUE TRY --- */
        console.log(chalk.bgRed.white("Error" + err.message));
        console.log(err);
        process.exit(-1);
    }
})();

/* --- APP COMUNICACION SERIAL ---*/
const port = new SerialPort(
    "COM3",
    {baudRate: 115200}
)

const parser = new SerialPort.parsers.Readline()

port.pipe(parser)

parser.on('data', (line)=>{
    let echo = line.search('echo')
    if(echo == -1){
        let indT = line.search('T');
        let indTf = line.search('/');
        Te = Number(line.slice(indT+2,indTf-1));
        let indB = line.search('B');
        let indBf = line.search('@');
        Tb = Number(line.slice(indB+2,indBf-7));
        // console.log("Tb =",Tb);
        // console.log("Te =",Te);     
    }
    
    console.log(line);
})


port.on('open', function(){
    console.log('puerto serial abierto');
});

port.on('err', function(err){
    console.log("Fallo con la conexion serial");
});

// setTimeout(()=>{
//     port.write("G28\r\n");   // Mandar a home
// },6000)


// setInterval(()=>{
// //     // port.write("M114 \r\n");   // Pedir posiciones
//     port.write("M105 \r\n");  // Pedir temperaturas
// },1000)



/* --- Comunicacion I2C --- */

// raspi.init(() => {
//   const i2c = new I2C();
//   console.log(i2c.readByteSync(0x18)); // Read one byte from the device at address 18
// });