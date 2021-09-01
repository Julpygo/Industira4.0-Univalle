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
                nodesets.standard,
                nodesets.cnc,
                nodesets.di,
                nodesets.machinery,
                I4AAS
            ],
            /* ---- */
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
        const nsMch = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/");    // NS DE MACHINARY(URI)
        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");    // NS DE DI(URI)
        const nsAAS = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/I4AAS/");    // NS DE I4AAS(URI)
        const namespace = addressSpace.getOwnNamespace("http://opcfoundation.org/UA/");   // Crear nuestro namespace(NS) 

        /* --- BUSCAR OBJECTYPES A INSTANCIAR --- */
        const CncInterfaceType = addressSpace.findObjectType("CncInterfaceType",nsCnc);
        const CncAxisType = addressSpace.findObjectType("CncAxisType",nsCnc);
        const DeviceType = addressSpace.findObjectType("DeviceType",nsDI);
        const IMachineVendorNameplateType = addressSpace.findObjectType("IMachineVendorNameplateType",nsMch);
        const AASAssetAdministrationShellType = addressSpace.findObjectType("AASAssetAdministrationShellType",nsAAS);
        const AASReferenceType = addressSpace.findObjectType("AASReferenceType",nsAAS);
        const AASSubmodelType = addressSpace.findObjectType("AASSubmodelType",nsAAS);
        const AASConceptDictionaryType = addressSpace.findObjectType("AASConceptDictionaryType",nsAAS);
        const IAASIdentifiableType = addressSpace.findObjectType("IAASIdentifiableType",nsAAS);
        const DerivedFrom = addressSpace.findNode("ns=5;i=5007",nsAAS);
        
        /* --- ESPACIO PARA INSTANCIAR, CREAR Y MAPEAR (OBJETOS, VARIABLES, METODOS) --- */
        
        /* --- CREAR OBJETOS ---*/
        const AASROOT = namespace.addFolder(addressSpace.rootFolder.objects,{
            browseName: "AASROOT"
        });
        const impresora = namespace.addObject({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "AAS Impresora"
        });
        const document = namespace.addObject({
            componentOf: impresora,
            browseName: "Submodel:Document"
        });

        /* --- INSTANCIAR OBJECTTYPES ---*/ 
        const opc40502 = CncInterfaceType.instantiate({
            browseName: "Submodel:OperationalData",
            componentOf: impresora,
        });
        const CncAxisList = addressSpace.findNode("ns=1;i=1004");   // nivel inferior del CncInterface instanciado
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

        const IdImpresoraType = namespace.addObjectType({
            browseName: "IdImpresoraType",
            isAbstract: false,
            subtypeOf: DeviceType
        })
        const NameplateType = namespace.addObjectType({
            browseName: "NameplateType",
            isAbstract: false,
            subtypeOf: IMachineVendorNameplateType
        })
        const Identification = IdImpresoraType.instantiate({
            browseName: "Submodel:Identification",
            componentOf: impresora,
        });
        const Nameplate = NameplateType.instantiate({
            browseName: "Submodel:Nameplate",
            componentOf: impresora,
        });
        const AAS = AASAssetAdministrationShellType.instantiate({
            browseName: "AssetAdministrationShell:Impresora3D",
            componentOf: AASROOT,
            // optionals: 
        });
        AAS.addReference({
            referenceType: "HasComponent",
            nodeId: DerivedFrom
        })
        AAS.addReference({
            referenceType: "HasInterface",
            nodeId: IAASIdentifiableType
        })
        const AAS1 = AASReferenceType.instantiate({
            browseName: "AASReferenceType",
            componentOf: AAS,
        });
        const AAS2 = AASSubmodelType.instantiate({
            browseName: "AASSubmodelType",
            componentOf: AAS,
        });
        const AAS3 = AASConceptDictionaryType.instantiate({
            browseName: "AASConceptDictionaryType",
            componentOf: AAS,
        });
        // const IdentificationModel = namespace.addObject({
        //     organizedBy: addressSpace.rootFolder.objects,
        //     browseName: "AssetIdentificationModel"
        // });

        /* --- AGREAGAR OTRAS VARIABLES --- */
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
        const IsRotational = addressSpace.findNode("ns=1;i=1048");
        const ActPosX = addressSpace.findNode("ns=1;i=1056");
        const ActPosY = addressSpace.findNode("ns=1;i=1090");
        const ActPosZ = addressSpace.findNode("ns=1;i=1118");

        /* --- MAPEAR VARIABLES --- */
        IsRotational.setValueFromSource({ dataType: "Boolean", value: true});
        setInterval(() => {
            ActPosX.setValueFromSource({dataType: "Double", value: 50*Math.random()+PosX})
            ActPosY.setValueFromSource({dataType: "Double", value: 50*Math.random()+PosY})
            ActPosZ.setValueFromSource({dataType: "Double", value: 50*Math.random()+PosZ})
            Tb = 50*Math.random()
            Te = 50*Math.random()
        }, 500);

        /* --- AÑADIR METODOS ---*/
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
// const Readline = SerialPort.parsers.Readline;
// const parser = new Readline();
// const mySerial = new SerialPort("COM2",{
//     baudRate: 115200
// })
// mySerial.on('open', function(){
//     console.log('puerto serial abierto');
// });
// mySerial.on('data', function(data){
//     let binarios = data;    //buffers recividos
//     let datosSerial = binarios.toString();  //Decodificacion a str
//     let fin = datosSerial.search('\r\n');
//     if(fin != -1){
//         strdata = strdata + datosSerial;
//         let indX = strdata.search('X');
//         let indY = strdata.search('Y');
//         let indZ = strdata.search('Z');
//         let indArro = strdata.search('@');
//         PosX = Number(strdata.slice(indX+2,indY-1));
//         PosY = Number(strdata.slice(indY+2,indZ-1));
//         PosZ = Number(strdata.slice(indZ+2,indArro-1));
//         let indT = strdata.search('T');
//         let indTf = strdata.search('/');
//         Tb = Number(strdata.slice(indT+2,indTf-1));
//         strdata = '';
//     }
//     else{
//         strdata = strdata + datosSerial;
//     };
// });
// mySerial.on('err', function(err){
//     console.log("Fallo con la conexion serial");
// });
// setInterval(()=>{
//     mySerial.write("M114 M105\r\n");
// },5000);

/* --- Comunicacion I2C --- */

// raspi.init(() => {
//   const i2c = new I2C();
//   console.log(i2c.readByteSync(0x18)); // Read one byte from the device at address 18
// });