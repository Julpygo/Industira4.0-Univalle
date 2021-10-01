/*--- IMPORTACION DE MODULOS --- */

const { OPCUAServer, DataType, nodesets,StatusCodes, Variant } = require("node-opcua");
const chalk = require("chalk");
const SerialPort = require('serialport');
// const raspi = require('raspi');
// const I2C = require('raspi-i2c').I2C;


/* --- VARIABLES GLOBALES --- */

PosX = ''; PosY = ''; PosZ = '';
Tb = ''; Te = '';    // Tb: temperatura base, Te: temperatura extrusor
P = ''; I = ''; D = ''; S = '';     // PID hottend y variable de simulacion
Df = ''; PasosE = ''; PasosX = ''; PasosY = ''; PasosZ = ''; VmaxX = '';
VmaxY = ''; VmaxZ = ''; VmaxE = ''; AmaxE = ''; AmaxX = ''; AmaxY = ''; AmaxZ = '';
errImp = ''; T = '';
const I4AAS = "Opc.Ua.I4AAS.NodeSet2.xml"

/* --- ACCESO DE USUARIOS --- */

const userManager = {
    isValidUser: function(userName, password) {
        if (userName === "julian" && password === "1234") {return true;}
        if (userName === "user2" && password === "password2") {return true;}
        return false;}
    };

/* --- SERVIDOR UA ASINCRONO --- */

(async () => {
    try {
        /* --- PARAMETROS DEL SERVIDOR --- */

        const server = new OPCUAServer({
            nodeset_filename: [nodesets.standard, nodesets.cnc, nodesets.di, I4AAS],    // Especificaciones UA
            serverInfo: {applicationName: { text: "Servidor ImpresoraFDM", locale: "es" },},
            userManager: userManager,
            port: 4334,     // puerto del servidor
            resourcePath: "/UA/ImpresoraServer",    // this path will be added to the endpoint resource name
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
        const CncAlarmType = addressSpace.findObjectType("CncAlarmType",nsCnc);
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

        const AASROOT = namespace.addFolder(addressSpace.rootFolder.objects,{browseName: "AASROOT"});
        const AAS = AASAssetAdministrationShellType.instantiate({
            browseName: "AssetAdministrationShell:Impresora3D",
            organizedBy: AASROOT, 
        });
        AAS.addReference({referenceType: "HasComponent", nodeId: DerivedFrom.clone()});
        AAS.addReference({referenceType: "HasProperty", nodeId: ShortName});
        AAS.addReference({referenceType: "HasInterface", nodeId: IAASIdentifiableType});

        const Asset = addressSpace.findNode("ns=1;i=1003");
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
            browseName: "E:Extrusor",
            componentOf: CncAxisList,
        });
        const CncAxisX = CncAxisType.instantiate({
            browseName: "X",
            componentOf: CncAxisList,
        });
        const CncAxisY = CncAxisType.instantiate({
            browseName: "Y:Base",
            componentOf: CncAxisList,
        });
        const CncAxisZ = CncAxisType.instantiate({
            browseName: "Z",
            componentOf: CncAxisList,
        });
        
        /* --- VARIABLES ADICIONALES --- */

        const TempBase = namespace.addVariable({
            componentOf: CncAxisY,
            browseName: "T base",
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: Tb})
            },
        });
        const TempExtr = namespace.addVariable({
            componentOf: CncAxisExtrusor,
            browseName: "T extrusor",
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: Te})
            },
        });

        const Parametros = namespace.addObject({
            browseName: "Parametros",
            componentOf: opc40502
        });
        const Dfilamento = namespace.addVariable({
            browseName: "Df",
            description: "Diametro del filamento",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: Df})},
            componentOf: Parametros
        });
        const steps = namespace.addObject({
            browseName: "StepsUnit",
            description: "Pasos por unidad",
            componentOf: Parametros
        });
        const stepsX = namespace.addVariable({
            browseName: "stepsX",
            description: "Pasos por unidad eje x",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: PasosX})},
            componentOf: steps
        });
        const stepsY = namespace.addVariable({
            browseName: "stepsY",
            description: "Pasos por unidad eje y",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: PasosY})},
            componentOf: steps
        });
        const stepsZ = namespace.addVariable({
            browseName: "stepsZ",
            description: "Pasos por unidad eje z",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: PasosZ})},
            componentOf: steps
        });
        const stepsE = namespace.addVariable({
            browseName: "stepsE",
            description: "Pasos por unidad eje E",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: PasosE})},
            componentOf: steps
        });
        const MaxFeedrates = namespace.addObject({
            browseName: "MaxFeedrates",
            description: "Velocidad máxima de avance",
            componentOf: Parametros
        });
        const MaxFeedratesX = namespace.addVariable({
            browseName: "MaxFeedratesX",
            description: "Velocidad máxima de avance eje X",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: VmaxX})},
            componentOf: MaxFeedrates
        });
        const MaxFeedratesY = namespace.addVariable({
            browseName: "MaxFeedratesY",
            description: "Velocidad máxima de avance eje Y",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: VmaxY})},
            componentOf: MaxFeedrates
        });
        const MaxFeedratesZ = namespace.addVariable({
            browseName: "MaxFeedratesZ",
            description: "Velocidad máxima de avance eje Z",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: VmaxZ})},
            componentOf: MaxFeedrates
        });
        const MaxFeedratesE = namespace.addVariable({
            browseName: "MaxFeedratesE",
            description: "Velocidad máxima de avance eje E",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: VmaxE})},
            componentOf: MaxFeedrates
        });
        const MaxAceleracion = namespace.addObject({
            browseName: "MaxAceleracion",
            description: "Aceleración máxima",
            componentOf: Parametros
        });
        const MaxAceleracionX = namespace.addVariable({
            browseName: "MaxAceleracionX",
            description: "Aceleración máxima eje X",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: AmaxX})},
            componentOf: MaxAceleracion
        });
        const MaxAceleracionY = namespace.addVariable({
            browseName: "MaxAceleracionY",
            description: "Aceleración máxima eje Y",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: AmaxY})},
            componentOf: MaxAceleracion
        });
        const MaxAceleracionZ = namespace.addVariable({
            browseName: "MaxAceleracionZ",
            description: "Aceleración máxima eje Z",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: AmaxZ})},
            componentOf: MaxAceleracion
        });
        const MaxAceleracionE = namespace.addVariable({
            browseName: "MaxAceleracionE",
            description: "Aceleración máxima eje E",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: AmaxE})},
            componentOf: MaxAceleracion
        });
        const DefaultPLA = namespace.addVariable({
            browseName: "DefaultPLA",
            description: "Parametros por defecto para impresion con PLA",
            dataType: "Double",
            componentOf: Parametros
        });
        const PID_Hottend = namespace.addObject({
            browseName: "PID_Hottend",
            description: "Parametros PID por defecto para hottend",
            componentOf: Parametros
        });
        const P_Hottend = namespace.addVariable({
            browseName: "P",
            description: "Valor proporcional",
            componentOf: PID_Hottend,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: P})
            }
        })
        const I_Hottend = namespace.addVariable({
            browseName: "I",
            description: "Valor integral",
            componentOf: PID_Hottend,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: I})
            }
        })
        const D_Hottend = namespace.addVariable({
            browseName: "D",
            description: "Valor derivado",
            componentOf: PID_Hottend,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: D})
            }
        })

        const Alarm = namespace.addObject({
            browseName: "Alarmas",
            componentOf: opc40502,
        });
        const Error = namespace.addVariable({
            browseName: "Error",
            componentOf: Alarm,
            dataType: "String",
            value: {
                get: () => new Variant({ dataType: DataType.String, value: errImp})
            }
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
            port.write(inCode);
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
    if(line.search('echo') != -1){
        if(line.search('G21 ') != -1){      // Unidades en [mm]
            unit = 'mm'
            // console.log('unidades en',unit);
        }
        else if(line.search('G20 ') != -1){      // Unidades en [in]
            unit = 'in'
            // console.log('unidades en',unit);
        }
        else if(line.search('M149') != -1){      // unidades de las temperaturas
            if(line.search('C') != -1){
                unitT = 'C'
                // console.log('Temperaturas en',unitT);
            }
            else if(line.search('F') != -1){
                unitT = 'F'
                // console.log('Temperaturas en',unitT);
            }
            else{
                unitT = 'K'
                // console.log('Temperaturas en',unitT);
            }
            
        }
        else if(line.search('M200') != -1){      // Diametro del filamento [unit] 
            Df = line.slice(line.search('D')+1,)
            // console.log('Df',Df);
        }
        else if(line.search('M92') != -1){      // Pasos por unidad [pasos/unit]
            PasosX = line.slice(line.search('X')+1,line.search('Y')-1);
            PasosY = line.slice(line.search('Y')+1,line.search('Z')-1);
            PasosZ = line.slice(line.search('Z')+1,line.search('E')-1);
            PasosE = line.slice(line.search('E')+1,);
            // console.log('PasosmmX',PasosmmX,'PasosmmY',PasosmmY,'PasosmmZ',PasosmmZ,'PasosmmE',PasosmmE);
        }   
        else if(line.search('M203') != -1){     // Velocidad maxima de avance [unit/s]
            VmaxX = line.slice(line.search('X')+1,line.search('Y')-1);
            VmaxY = line.slice(line.search('Y')+1,line.search('Z')-1);
            VmaxZ = line.slice(line.search('Z')+1,line.search('E')-1);
            VmaxE = line.slice(line.search('E')+1,);
            // console.log('VmaxX',VmaxX,'VmaxY',VmaxY,'VmaxZ',VmaxZ,'VmaxE',VmaxE);
        }
        else if(line.search('M201') != -1){     // Aceleracion maxima [unit/s2]
            AmaxX = line.slice(line.search('X')+1,line.search('Y')-1);
            AmaxY = line.slice(line.search('Y')+1,line.search('Z')-1);
            AmaxZ = line.slice(line.search('Z')+1,line.search('E')-1);
            AmaxE = line.slice(line.search('E')+1,);
            // console.log('AmaxX',AmaxX,'AmaxY',AmaxY,'AmaxZ',AmaxZ,'AmaxE',AmaxE);
        }
        else if(line.search('M204') != -1){     // Aceleraciones de impresion, retraccion y viaje [unit/s2]
            APrint = line.slice(line.search('P')+1,line.search('R')-1);
            Aretract = line.slice(line.search('R')+1,line.search('T')-1);
            Atravel = line.slice(line.search('T')+1,);
            // console.log('APrint',APrint,'Aretract',Aretract,'Atravel',Atravel);
        }
        else if(line.search('M301') != -1){     // Parametros PID
            P = line.slice(line.search('P')+1,line.search('I')-1);
            I = line.slice(line.search('I')+1,line.search('D')-1);
            D = line.slice(line.search('D')+1,);
            // console.log('P',P,'I',I,'D',D);
        }
        else if(line.search('Error') != -1){     // Mensaje de error impresora
            errImp = line;
            // console.log('error impresora',errImp,);
        }
    }
    else{
        Te = Number(line.slice(line.search('T')+2,line.search('/')-1));
        Tb = Number(line.slice(line.search('B')+2,line.search('@')-7));
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

setTimeout(()=>{
    // port.write("G28\r\n");   // Mandar a home (comandos sin \r\n no funcionan )
    T = 'Prueba'
    port.write("M155 S4\r\n");  // Pedir temperaturas cada 4 segundos (Evita errores en la impresion)
    // port.write("M115\r\n")      // Informacion del Firmware
},8000)


// setInterval(()=>{
//     port.write("M114 \r\n");   // Pedir posiciones 
//     // port.write("M105 \r\n");  // Pedir temperaturas
// },1000)

/* --- SIMULACION DE CAMBIO DE TEMPERATURAS POR SEGUNDO --- */
setInterval(() => {
    S = 40*Math.random()
}, 1000);



/* --- Comunicacion I2C --- */

// raspi.init(() => {
//   const i2c = new I2C();
//   console.log(i2c.readByteSync(0x18)); // Read one byte from the device at address 18
// });