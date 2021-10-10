/*--- IMPORTACION DE MODULOS --- */

const { OPCUAServer, DataType, nodesets,StatusCodes, Variant, VariantArrayType} = require("node-opcua");
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
errImp = ''; T = ''; Pm = '';
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

        /* --- Cnc ObjectTypes ---*/
        const CncInterfaceType = addressSpace.findObjectType("CncInterfaceType",nsCnc);
        const CncAxisType = addressSpace.findObjectType("CncAxisType",nsCnc);
        /* --- I4AAS ObjectTypes ---*/
        const AASAssetAdministrationShellType = addressSpace.findObjectType("AASAssetAdministrationShellType",nsAAS);
        const AASReferenceType = addressSpace.findObjectType("AASReferenceType",nsAAS);
        const AASSubmodelType = addressSpace.findObjectType("AASSubmodelType",nsAAS);
        const AASConceptDictionaryType = addressSpace.findObjectType("AASConceptDictionaryType",nsAAS);
        const IAASIdentifiableType = addressSpace.findObjectType("IAASIdentifiableType",nsAAS);
        const AASIdentifierType = addressSpace.findObjectType("AASIdentifierType",nsAAS);
        const AASFileType = addressSpace.findObjectType("AASFileType",nsAAS);
        const AASSubmodelElementCollectionType = addressSpace.findObjectType("AASSubmodelElementCollectionType",nsAAS);
        const AASPropertyType = addressSpace.findObjectType("AASPropertyType",nsAAS)
        const AASIrdiConceptDescriptionType = addressSpace.findObjectType('AASIrdiConceptDescriptionType',nsAAS)
        const AASDataSpecificationIEC61360Type = addressSpace.findObjectType('AASDataSpecificationIEC61360Type',nsAAS)
        const FileType = addressSpace.findObjectType("FileType", 0);
        // const AASKeyTypeDataType = addressSpace.findNode("ns=4;i=6108", nsAAS);
        
        /* --- BUSCAR nodos para clonar --- */

        const AssetId = addressSpace.findNode("ns=3;i=15049",nsDI);
        const Manufacturer = addressSpace.findNode("ns=3;i=15036",nsDI);
        const ManufacturerUri = addressSpace.findNode("ns=3;i=15037",nsDI);
        const Model = addressSpace.findNode("ns=3;i=15038",nsDI);
        const SerialNumber = addressSpace.findNode("ns=3;i=15045",nsDI);
        const SoftwareRevision = addressSpace.findNode("ns=3;i=15040",nsDI);
        const ShortName = addressSpace.findNode("ns=4;i=6066",nsAAS);
        

        /* --- ESPACIO PARA INSTANCIAR, CREAR Y MAPEAR (OBJETOS, VARIABLES, METODOS) --- */    
        /* --- ESTRUCTURACION DEL AAS ---*/

        const AASROOT = namespace.addFolder(addressSpace.rootFolder.objects,{browseName: "AASROOT"});
        const AAS = AASAssetAdministrationShellType.instantiate({
            browseName: "Impresora3dPRUSA",
            organizedBy: AASROOT,
            optionals:["DerivedFrom"]
        });
        /* --- Añadir referencias al AAS ---*/
        AAS.addReference({referenceType: "HasProperty", nodeId: ShortName.clone()});
        AAS.addReference({referenceType: "HasInterface", nodeId: IAASIdentifiableType});

        const IdentificationAAS = AASIdentifierType.instantiate({
            browseName: "IdentificationAAS",
            componentOf: AAS
        })
        const IdentificationAsset = AASIdentifierType.instantiate({
            browseName: "AssetIdentification",
            componentOf: AAS.asset.nodeId
        })
        const AssetIdentificationModel = AASReferenceType.instantiate({
            browseName: "AssetIdentificationModel",
            componentOf: AAS.asset.nodeId
        });
        const AASSubmodelID = AASSubmodelType.instantiate({
            browseName: "IdentificationModel",
            componentOf: AAS,
            optionals:[
                "SubmodelElement.IdShort"
            ]
        });
        const IdentificationID = AASIdentifierType.instantiate({
            browseName: "Identification",
            componentOf: AASSubmodelID
        })

        /* --- Añadir referencias al Submodelo de identificacion ---*/
        AssetIdentificationModel.addReference({referenceType: "ns=4;i=4003", nodeId: AASSubmodelID})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: AssetId.clone()})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: Manufacturer.clone()})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: ManufacturerUri.clone()})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: Model.clone()})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: SerialNumber.clone()})
        AASSubmodelID.addReference({referenceType: "HasProperty",nodeId: SoftwareRevision.clone()})

        const AASSubmodelDoc = AASSubmodelType.instantiate({
            browseName: "DocumentsModel",
            componentOf: AAS,
        });
        const OperationManual = AASSubmodelElementCollectionType.instantiate({
            browseName: "OperationManual",
            componentOf: AASSubmodelDoc,
            optionals:["AllowDuplicates"]
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
            browseName: "ConceptDictionary",
            componentOf: AAS,
        });


        /* --- SUBMODELO CNC ---*/ 
        
        const SubmodelOperational = AASSubmodelType.instantiate({
            browseName: "OperationalDataModel",
            componentOf: AAS
        })
        const opc40502 = CncInterfaceType.instantiate({
            browseName: "CncInterface",
            componentOf: SubmodelOperational,
        });
        
        const CncAxisExtrusor = CncAxisType.instantiate({
            browseName: "E:Extrusor",
            componentOf: opc40502.cncAxisList.nodeId
        });
        const CncAxisX = CncAxisType.instantiate({
            browseName: "X",
            componentOf: opc40502.cncAxisList.nodeId,
        });
        const CncAxisY = CncAxisType.instantiate({
            browseName: "Y:Base",
            componentOf: opc40502.cncAxisList.nodeId,
        });
        const CncAxisZ = CncAxisType.instantiate({
            browseName: "Z",
            componentOf: opc40502.cncAxisList.nodeId,
        });
        
        /* --- SUBMODELO DE DATOS TECNICOS --- */

        const AASSubmodelTec = AASSubmodelType.instantiate({
            browseName: "TecnhicalDataModel",
            componentOf: AAS
        })
        const IdSubmodelTec = AASIdentifierType.instantiate({
            browseName: "Identification",
            componentOf: AASSubmodelTec
        });
        const Dfilamento = namespace.addVariable({
            browseName: "Df",
            description: {locale: "es", text: "Diametro del filamento"},
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: Df})},
            componentOf: AASSubmodelTec
        });
        const steps = namespace.addObject({
            browseName: "StepsUnit",
            description: "Pasos por unidad",
            componentOf: AASSubmodelTec
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
            componentOf: AASSubmodelTec
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
            componentOf: AASSubmodelTec
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
            componentOf: AASSubmodelTec
        });
        const PID_Hottend = namespace.addObject({
            browseName: "PID_Hottend",
            description: "Parametros PID por defecto para hottend",
            componentOf: AASSubmodelTec
        });
        const P_Hottend = namespace.addVariable({
            browseName: "P",
            description: "Valor proporcional",
            componentOf: PID_Hottend,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: P+Pm})
            }
        })
        const I_Hottend = namespace.addVariable({
            browseName: "I",
            description: "Valor integral",
            componentOf: PID_Hottend,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: I+Pm})
            }
        })
        const D_Hottend = namespace.addVariable({
            browseName: "D",
            description: "Valor derivado",
            componentOf: PID_Hottend,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: D+Pm})
            }
        })
        const dicDiam = AASIrdiConceptDescriptionType.instantiate({
            browseName: "0173-1#01-AKH746#018",
            componentOf: AASConceptDictionary
        })
        const DiamPrueba = AASPropertyType.instantiate({
            browseName: "Diametro prueba",
            componentOf: AASSubmodelTec,
            optionals: ["Value"]
        })
        DiamPrueba.addReference({referenceType:"HasDictionaryEntry",nodeId: dicDiam})
        const DataSpecification = AASDataSpecificationIEC61360Type.instantiate({
            browseName: "DataSpecification",
            componentOf: DiamPrueba
        })
        DataSpecification.identification.id.setValueFromSource({dataType:"String",value: "Prueba"})
        // addressSpace.constructExtensionObject
        dicDiam.addReference({referenceType:"HasAddIn",nodeId:DataSpecification})

        /* --- VARIABLES ADICIONALES --- */

        const TempBase = namespace.addVariable({
            componentOf: SubmodelOperational,
            browseName: "T base",
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: Tb+S})
            },
        });
        const TempExtr = namespace.addVariable({
            componentOf: SubmodelOperational,
            browseName: "T extrusor",
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: Te+S})
            },
        });
        const Alarm = namespace.addObject({
            browseName: "Alarmas",
            componentOf: opc40502,
        });
        const Error = namespace.addVariable({
            browseName: "Error",
            componentOf: Alarm,
            dataType: "String",
            value: {
                get: () => new Variant({ dataType: DataType.String, value: errImp+T})
            }
        });

        /* --- MAPEAR VARIABLES --- */
        /* --- mapeo unico ---*/

        /* --- Identificacion general ---*/
        IdentificationAAS.id.setValueFromSource({ dataType: "String", 
            value: "https://www.univalle.edu.co/eime/aas/1/1/AAS-3DPrinter"
        });
        IdentificationAAS.idType.setValueFromSource({ dataType: "Int32", value:1});
        
        IdentificationAsset.id.setValueFromSource({ dataType: "String", 
            value: "https://impresoras3dcolombia.co/IP3DPRUSA"
        });
        IdentificationAsset.idType.setValueFromSource({ dataType: "Int32", value:1});

        AAS.asset.assetKind.setValueFromSource({ dataType: "Int32", value:1});   
        AAS.asset.assetIdentificationModel.keys.setValueFromSource({ dataType: DataType.String,
            value: "(Submodel)[IRI]https://impresoras3dcolombia.co/IP3DPRUSA"
        });
            
        AASfile.value.setValueFromSource({ dataType: "String", value: "creality-ender-3-3d-printer-manual.pdf"})
        AASfile.mimeType.setValueFromSource({ dataType: "String", value: "application/pdf"})
        File.size.setValueFromSource({dataType: "UInt64", value: 828480})
        AAS.shortName.setValueFromSource({ dataType: DataType.LocalizedText,
            value: [{locale: "es",text: "Impresora 3D"},{locale: "en",text: "Printer 3D"}]
        })

        /* --- CREAR METODOS ---*/

        const method = namespace.addMethod(SubmodelOperational,{
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
    T = 'Prueba';
    Pm = 30*Math.random();
    // port.write("M155 S4\r\n");  // Pedir temperaturas cada 4 segundos (Evita errores en la impresion)
    // port.write("M115\r\n")      // Informacion del Firmware
},8000)


// setInterval(()=>{
//     port.write("M114 \r\n");   // Pedir posiciones 
//     // port.write("M105 \r\n");  // Pedir temperaturas
// },1000)

/* --- SIMULACION DE CAMBIO DE TEMPERATURAS POR SEGUNDO --- */
setInterval(() => {
    S = 60*Math.random()
}, 5000);



/* --- Comunicacion I2C --- */

// raspi.init(() => {
//   const i2c = new I2C();
//   console.log(i2c.readByteSync(0x18)); // Read one byte from the device at address 18
// });              