/*--- IMPORTACION DE MODULOS --- */

const { OPCUAServer,DataType,nodesets,
    StatusCodes,Variant,standardUnits} = require("node-opcua");
const chalk = require("chalk");
const SerialPort = require('serialport');
// const raspi = require('raspi');
// const I2C = require('raspi-i2c').I2C;


/* --- VARIABLES GLOBALES --- */

Tb = ''; Te = '';   
P = ''; I = ''; D = '';   // PID hottend 
// Parametros
Df = ''; PasosE = ''; PasosX = ''; PasosY = ''; PasosZ = ''; 
VmaxX = ''; VmaxY = ''; VmaxZ = ''; VmaxE = ''; AmaxE = ''; 
AmaxX = ''; AmaxY = ''; AmaxZ = ''; errImp = ''; errores = [], errImpPasado = 'inicial', Pm = '';
const I4AAS = "Opc.Ua.I4AAS.NodeSet2.xml";


/* --- ACCESO DE USUARIOS --- */

const userManager = {
    isValidUser: function(userName, password) {
        if (userName === "julian" && password === "1234") {return true;}
        if (userName === "user2" && password === "clave") {return true;}
        return false;}
    };


/* --- SERVIDOR UA ASINCRONO --- */

(async () => {
    try {
        /* --- PARAMETROS DEL SERVIDOR --- */

        const server = new OPCUAServer({
            nodeset_filename: [
                nodesets.standard,
                I4AAS,
                nodesets.cnc,
                nodesets.di,
                nodesets.machinery],   
            serverInfo: {applicationName: { 
                text: "Servidor ImpresoraFDM", 
                locale: "ES" }
            },
            userManager: userManager, 
            port: 4334, resourcePath: "/UA/ImpresoraServer",   
            buildInfo : {
                productName: "ServidorImpresorasFDM", 
                buildNumber: "7658", buildDate: new Date(2021,1,16)
            }
        });


        /* --- DEFINICION DEL ESPACIO DE DIRECCIONES ---*/

        await server.initialize();
        const addressSpace = server.engine.addressSpace;    // generar addressSpace inicial
        const namespace = addressSpace.getOwnNamespace("http://opcfoundation.org/UA/");   // Mi namespace(ns) 
        const nsAAS = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/I4AAS/");  
        const nsCnc = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CNC");      
        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        const nsMachinery = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/");


        /* --- BUSCAR OBJECTYPES A INSTANCIAR --- */

        /* --- Cnc ObjectTypes ---*/
        const CncInterfaceType = addressSpace.findObjectType("CncInterfaceType",nsCnc);
        const CncAxisType = addressSpace.findObjectType("CncAxisType",nsCnc);
        const CncChannelType = addressSpace.findObjectType("CncChannelType",nsCnc);
        const CncSpindleType = addressSpace.findObjectType("CncSpindleType",nsCnc);
        const CncMessageType = addressSpace.findObjectType("CncMessageType",nsCnc);
        /* --- I4AAS ObjectTypes ---*/
        const AASAssetAdministrationShellType = addressSpace.findObjectType("AASAssetAdministrationShellType",nsAAS);
        const AASReferenceType = addressSpace.findObjectType("AASReferenceType",nsAAS);
        const AASSubmodelType = addressSpace.findObjectType("AASSubmodelType",nsAAS);
        const AASConceptDictionaryType = addressSpace.findObjectType("AASConceptDictionaryType",nsAAS);
        const IAASIdentifiableType = addressSpace.findObjectType("IAASIdentifiableType",nsAAS);
        const AASIdentifierType = addressSpace.findObjectType("AASIdentifierType",nsAAS);
        const AASPropertyType = addressSpace.findObjectType("AASPropertyType",nsAAS);
        const AASIrdiConceptDescriptionType = addressSpace.findObjectType('AASIrdiConceptDescriptionType',nsAAS);
        const AASDataSpecificationIEC61360Type = addressSpace.findObjectType('AASDataSpecificationIEC61360Type',nsAAS);
        const AASAdministrativeInformationType = addressSpace.findObjectType('AASAdministrativeInformationType',nsAAS);
        const FileType = addressSpace.findObjectType("FileType", 0);
        /* --- DI y Machinary Types ---*/
        const ComponentType = addressSpace.findObjectType("ComponentType",nsDI);
        const machineIdentificationType = addressSpace.findObjectType("MachineIdentificationType", nsMachinery);

        
        /* --- ESPACIO PARA INSTANCIAR, CREAR Y MAPEAR (OBJETOS, VARIABLES, METODOS) --- */    
        

        /* --- MODELACION DEL AAS ---*/
        const AASROOT = namespace.addFolder(addressSpace.rootFolder.objects,{
            browseName: "AASROOT"
        });
        const AAS = AASAssetAdministrationShellType.instantiate({
            browseName: "Impresora3dPRUSA",
            organizedBy: AASROOT,
            optionals:["DerivedFrom"]
        });
        const AAS_Id= AASIdentifierType.instantiate({
            browseName: "identification",
            componentOf: AAS
        });
        const administration = AASAdministrativeInformationType.instantiate({
            browseName: "administration",
            componentOf: AAS,
            optionals: ["Version","Revision"]
        });
        AAS.addReference({referenceType: "HasInterface", nodeId: IAASIdentifiableType});
        /* --- MAPEO ---*/
        AAS_Id.id.setValueFromSource({dataType: "String", 
            value: "https://www.univalle.edu.co/eime/aas/1/1/AAS-3DPrinter"
        });
        AAS_Id.idType.setValueFromSource({dataType: "Int32", value:1});
        administration.version.setValueFromSource({dataType: "String", value: "1"});
        administration.revision.setValueFromSource({dataType: "String", value: "1"});


        /* --- MODELACION DEL CONCEPTDICTIONARY ---*/
        const AASConceptDictionary = AASConceptDictionaryType.instantiate({
            browseName: "ConceptDictionary",
            componentOf: AAS,
        });
        const DfilamentoDicc = AASIrdiConceptDescriptionType.instantiate({
            browseName: "0173-1#01-AKH746#018",
            componentOf: AASConceptDictionary
        });


        /* --- MODELACION DEL ASSET ---*/
        const AssetId = AASIdentifierType.instantiate({
            browseName: "identification",
            componentOf: AAS.asset.nodeId
        });
        const AssetIdentificationModel = AASReferenceType.instantiate({
            browseName: "AssetIdentificationModel",
            componentOf: AAS.asset.nodeId
        });
        /* --- MAPEO ---*/
        AssetId.id.setValueFromSource({dataType: "String", 
            value: "https://impresoras3dcolombia.co/IP3DPRUSA"
        });
        AssetId.idType.setValueFromSource({dataType: "Int32", value:1});
        AAS.asset.assetKind.setValueFromSource({dataType: "Int32", value:1});   
        AAS.asset.assetIdentificationModel.keys.setValueFromSource({dataType: "String",
            value: "(Submodel)[IRI]https://impresoras3dcolombia.co/IP3DPRUSA"    
        });


        /* --- MODELACION DEL SUBMODELO DE IDENTIFICACION ---*/
        const SM_Identification = AASSubmodelType.instantiate({
            browseName: "SubmodelIdentification",
            componentOf: AAS
        });
        const SM_IdentificationId = AASIdentifierType.instantiate({
            browseName: "identification",
            componentOf: SM_Identification
        });
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.assetId.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.manufacturer.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.manufacturerUri.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: machineIdentificationType.location.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.model.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.hardwareRevision.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.softwareRevision.clone()});
        // AASSubmodelID.addReference({referenceType: "HasProperty", nodeId: machineIdentificationType.yearOfConstruction.clone()})
        /* --- Establecer referencia no jerarquica con el AssetIdentificationModel ---*/
        AssetIdentificationModel.addReference({referenceType: "ns=2;i=4003", nodeId: SM_Identification});
        /* --- MAPEO ---*/
        SM_Identification.assetId.setValueFromSource({dataType: "String", value: "IP3DPRUSA"});
        SM_Identification.manufacturer.setValueFromSource({dataType:DataType.LocalizedText,value:[{locale: "es", text: " IP3D"}]});
        SM_Identification.manufacturerUri.setValueFromSource({dataType: "String", value: "https://impresoras3dcolombia.co/"});
        SM_Identification.location.setValueFromSource({dataType: "String", value: "Cali, Colombia"});
        SM_Identification.model.setValueFromSource({dataType: DataType.LocalizedText, value: [{locale: "es", text: " Xmodelo"}]});
        SM_Identification.hardwareRevision.setValueFromSource({dataType: "String", value: "n"});
        SM_Identification.softwareRevision.setValueFromSource({dataType: "String", value: "n"});
        SM_IdentificationId.id.setValueFromSource({dataType:"String",value:" https://impresoras3dcolombia.co/IP3DPRUSA"});
        SM_IdentificationId.idType.setValueFromSource({dataType:"Int32",value: 1});
        SM_Identification.modelingKind.setValueFromSource({dataType:"Int32",value: 1});
        

        /* --- MODELACION DEL SUBMODELO OPERATIONAL DATA ---*/
        addressSpace.installAlarmsAndConditionsService();
        const SMOperational = AASSubmodelType.instantiate({
            browseName: "SubmodelOperationalData",
            componentOf: AAS
        });
        const SMOperationalId = AASIdentifierType.instantiate({
            browseName: "identification",
            componentOf: SMOperational
        });
        const CncInterface = CncInterfaceType.instantiate({
            browseName: "CncInterface",
            componentOf: SMOperational,
        });  
        const CncChannel = CncChannelType.instantiate({
            browseName: "Channel 1",
            eventNotifier: 0x01,
            componentOf: CncInterface.cncChannelList.nodeId
        });
        const CncSpindle = CncSpindleType.instantiate({
            browseName: "Extrusor",
            componentOf: CncInterface.cncSpindleList.nodeId
        });
        const CncAxisExtrusor = CncAxisType.instantiate({
            browseName: "E",
            componentOf: CncInterface.cncAxisList.nodeId
        });
        const CncAxisX = CncAxisType.instantiate({
            browseName: "X",
            componentOf: CncInterface.cncAxisList.nodeId
        });
        const CncAxisY = CncAxisType.instantiate({
            browseName: "Y[B]",
            componentOf: CncInterface.cncAxisList.nodeId
        });
        const CncAxisZ = CncAxisType.instantiate({
            browseName: "Z",
            componentOf: CncInterface.cncAxisList.nodeId
        });
        /* --- CREAR VARIABLES --- */
        const TempBase = namespace.addAnalogDataItem({
            componentOf: CncAxisY,
            browseName: "TempBase",
            definition: "Temperatura de la base caliente",
            valuePrecision: 0.01,
            engineeringUnitsRange: { low: 100, high: 200 },
            instrumentRange: { low: -100, high: +200 },
            engineeringUnits: standardUnits.degree_celsius,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: Tb})
            },
        });
        const TempExtr = namespace.addAnalogDataItem({
            componentOf: CncSpindle,
            browseName: "TempExtrusor",
            definition: "Temperatura del extrusor",
            valuePrecision: 0.01,
            engineeringUnitsRange: { low: 100, high: 200 },
            instrumentRange: { low: -100, high: +200 },
            engineeringUnits: standardUnits.degree_celsius,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: Te})
            },
        });
        const CncMessage = CncMessageType.instantiate({
            browseName: "CncMessage",
            notifierOf: addressSpace.rootFolder.objects.server,
            organizedBy: SMOperational
        });
        const Error = namespace.addVariable({
            browseName: "Error",
            componentOf: CncChannel,
            eventSourceOf: CncChannel,
            dataType: "String",
            value: {
                get: () => new Variant({ dataType: DataType.String, value: errImp})
            }
        });
        CncChannel.addReference({referenceType: "Organizes", nodeId:CncAxisExtrusor});
        CncChannel.addReference({referenceType: "Organizes", nodeId:CncAxisX});
        CncChannel.addReference({referenceType: "Organizes", nodeId:CncAxisY});
        CncChannel.addReference({referenceType: "Organizes", nodeId:CncAxisZ});
        CncChannel.addReference({referenceType: "Organizes", nodeId:CncSpindle});
        CncChannel.addReference({referenceType: "GeneratesEvent",nodeId:CncMessage});
        
        
        /* --- CREAR METODOS ---*/
        const method = namespace.addMethod(SMOperational,{
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
            port.write(`${inCode} \r\n` );
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
        /* --- MAPEO ---*/
        CncMessage.sourceNode.setValueFromSource({dataType: "NodeId",value: CncChannel.error.nodeId});
        CncMessage.eventType.setValueFromSource({dataType: "NodeId",value: CncMessageType.nodeId});
        CncMessage.sourceName.setValueFromSource({dataType: "String",value: "Mensaje de error"});
        CncMessage.eventId.setValueFromSource({dataType: "String", value: "Interrupt errors"});
        setInterval( ()=>{
            if(errImp != '' && errImpPasado != errImp){
                errores.push({locale:"EN",text: errImp})
                errImpPasado = errImp;
                CncMessage.message.setValueFromSource( new Variant ({
                    dataType: DataType.LocalizedText, 
                    value: errores,
                }))
            }
        },1000)
        SMOperationalId.id.setValueFromSource({dataType:"String",value:" url segun normativas"});
        SMOperationalId.idType.setValueFromSource({dataType:"Int32",value: 1});
        SMOperational.modelingKind.setValueFromSource({dataType:"Int32",value: 1});
        

        /* --- MODELACION DEL SUBMODELO TECHNICAL DATA ---*/
        const SMTechnical = AASSubmodelType.instantiate({
            browseName: "SubmodelTechnicalData",
            componentOf: AAS
        });
        const SMTechnicalId = AASIdentifierType.instantiate({
            browseName: "identification",
            componentOf: SMTechnical
        });
        const Dfilamento = AASPropertyType.instantiate({
            browseName: "DiametroFilamento",
            componentOf: SMTechnical,
            optionals: ["Value"]
        });
        Dfilamento.addReference({referenceType:"HasDictionaryEntry",nodeId: DfilamentoDicc});
        Dfilamento.valueType.setValueFromSource({dataType: "Int32",value: 10});
        Dfilamento.modelingKind.setValueFromSource({dataType: "Int32",value: 1});
        Dfilamento.category.setValueFromSource({dataType: "String",value: "Parametro"});
        Dfilamento.value.setValueFromSource({dataType: "Double",value: Df});    //meter en un setInterval
        const DataSpecification = AASDataSpecificationIEC61360Type.instantiate({
            browseName: "DataSpecification",
            componentOf: Dfilamento,
            optionals: ["Unit","Definition","DataType","Revision","Version"]
        });
        DataSpecification.identification.id.setValueFromSource({
            dataType: "String",
            value: "0112/2///61987#ABB961#001"
        });
        DataSpecification.identification.idType.setValueFromSource({
            dataType: "Int32",
            value: 0
        });
        DataSpecification.preferredName.setValueFromSource({
            dataType: DataType.LocalizedText,
            value: {locale:"EN",text:"size of orifice"}
        });
        DataSpecification.unit.setValueFromSource({
            dataType: "String",
            value: "mm"
        });
        DataSpecification.definition.setValueFromSource({
            dataType: DataType.LocalizedText,
            value:{locale:"EN",text:"internal diameter of a bore or orifice"}
        });
        DataSpecification.dataType.setValueFromSource({
            dataType: "Int32",
            value: 3
        });
        DfilamentoDicc.addReference({referenceType:"HasAddIn",nodeId:DataSpecification})
        
        const PID_Hottend = namespace.addObject({
            browseName: "PID_Hottend",
            description: "Parametros PID por defecto para hottend",
            componentOf: SMTechnical
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
        /* --- MAPEO ---*/
        SMTechnicalId.id.setValueFromSource({dataType:"String",value:" url segun normativas"});
        SMTechnicalId.idType.setValueFromSource({dataType:"Int32",value: 1});
        SMTechnical.modelingKind.setValueFromSource({dataType:"Int32",value: 1});


        /* --- BORRAR NODOS NO UTILIZADOS ---*/
        addressSpace.deleteNode(addressSpace.rootFolder.objects.deviceSet)
        addressSpace.deleteNode(addressSpace.rootFolder.objects.deviceTopology)
        addressSpace.deleteNode(addressSpace.rootFolder.objects.machines)
        addressSpace.deleteNode(addressSpace.rootFolder.objects.networkSet)
        addressSpace.deleteNode(addressSpace.rootFolder.objects.test)
        

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
    if(line.search('M200') != -1){      // Diametro del filamento [unit] 
        Df = line.slice(line.search('D')+1,)
        // console.log('Df',Df);
    }
    if(line.search('M301') != -1){     // Parametros PID
        P = line.slice(line.search('P')+1,line.search('I')-1);
        I = line.slice(line.search('I')+1,line.search('D')-1);
        D = line.slice(line.search('D')+1,);
        // console.log('P',P,'I',I,'D',D);
    }
    if(line.search('Error') != -1){     // Mensaje de error impresora
        errImp = line.slice(line.search(':')+1,);
        console.log('error impresora',errImp);
    }
    if(line.search("T:") != -1){
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
    port.write("M155 S2\r\n");  // Pedir temperaturas cada 4 segundos (Evita errores en la impresion)
    // port.write("M115\r\n")      // Informacion del Firmware
},10000)


/* --- Comunicacion I2C --- */

// raspi.init(() => {
//   const i2c = new I2C();
//   console.log(i2c.readByteSync(0x18)); // Read one byte from the device at address 18
// });