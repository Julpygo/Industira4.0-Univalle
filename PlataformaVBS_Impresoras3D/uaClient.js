/*--- IMPORTACION DE MODULOS --- */

const { OPCUAClient, AttributeIds, TimestampsToReturn, Variant, DataType, MonitoringMode} = require("node-opcua");
const MongoClient = require('mongodb').MongoClient;
const {cyan, bgRed, yellow} = require("chalk");
const SocketIO = require('socket.io');
const express = require("express");
const path = require('path');
var nodemailer = require('nodemailer');
var EventEmitter = require('events')

/* --- CREACION DE VARIABLES INICIALES --- */

var event = new EventEmitter();
gcodes = 'inicial';

/* --- CONSTANTES DEL SERVIDOR UA ---*/

const endpointUrl = "opc.tcp://" + require("os").hostname() + ":4334/UA/ImpresoraServer";
const nodeIdToMonitorTb = "ns=1;i=1322";   //Tb
const nodeIdToMonitorTe = "ns=1;i=1328";   //Te
const nodeIdToMonitorP = "ns=1;i=1368";   //P
const nodeIdToMonitorI = "ns=1;i=1369";   //I
const nodeIdToMonitorD = "ns=1;i=1370";   //D
const nodeIdToMonitorErr = "ns=1;i=1341";   // Error

/* --- CONSTASTES MONGO DB ---*/

const uri = "mongodb+srv://lianju:Yuligb1996@cluster0.z4spe.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
const clientmongo = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true});


/* --- CLIENTE UA --- */

(async () => {
  try {
    const client = OPCUAClient.create();    // crear cliente UA

    /* --- EVENTO DE RECONEXION --- */

    client.on("backoff", (retry, delay) => {
      console.log("Intentando conectarse a ", endpointUrl,
      ": Intento =", retry,
      "próximo intento en ", delay / 1000, "segundos")
    });

    /* --- INFORMACION DE CONEXION --- */

    await client.connect(endpointUrl);
    console.log(" Conectado a ", cyan(endpointUrl));

    /* --- CREAR SESSION DE CONEXION UA --- */

    const session = await client.createSession();
    console.log(yellow("Sesion iniciada"));   

    /* --- CREAR SUBSCRIBCION --- */

    const subscription = await session.createSubscription2({
      requestedPublishingInterval: 200,   //intervalo de tiempo en el cual se publica la solicitud
      requestedMaxKeepAliveCount: 20,     //intentos maximos para recuperar la conexion
      publishingEnabled: true,            //habilitar la publicacion
    });

    /* --- DEFINIR ITEMS A MONITOREAR --- */

    const itemToMonitorP = {nodeId: nodeIdToMonitorP, AttributeIds: AttributeIds.Value};
    const itemToMonitorI = {nodeId: nodeIdToMonitorI, AttributeIds: AttributeIds.Value};
    const itemToMonitorD = {nodeId: nodeIdToMonitorD, AttributeIds: AttributeIds.Value};
    const itemToMonitorErr = {nodeId: nodeIdToMonitorErr, AttributeIds: AttributeIds.Value};

    /* --- DEFINIR PARAMETROS DE SUSCRIPCION --- */

    const parameters = {
      samplingInterval: 50,   //tiempo de muestreo 
      discardOldest: true,    //descartar datos anteriores 
      queueSize: 1,          //tamaño de la cola de datos 
    };

    /* --- INICIAR MONITOREO POR SUBSCRIBCION --- */

    const monitoredItemP = await subscription.monitor(itemToMonitorP, parameters, TimestampsToReturn.Both);
    const monitoredItemI = await subscription.monitor(itemToMonitorI, parameters, TimestampsToReturn.Both);
    const monitoredItemD = await subscription.monitor(itemToMonitorD, parameters, TimestampsToReturn.Both);
    const monitoredItemErr = await subscription.monitor(itemToMonitorErr, parameters, TimestampsToReturn.Both);
    
    /* --- CONEXION A LA BASE DE DATOS --- */

    await clientmongo.connect();
    const collection = clientmongo.db("VarImpresora3D").collection("Historial de datos"); 

    /* --- ACTUALIZACION DE VARIABLES EN MONGO Y EN APP WEB --- */

    setInterval(()=>{
      session.read(nodeToRead = {nodeId: "ns=1;i=1322", attributeId: AttributeIds.Value},(err, data)=>{
        /* --- ACTUALIZACION EN MONGO --- */
        collection.insertOne({
          Variable: "Tb",
          valor: data.value.value, 
          tiempo: data.serverTimestamp
        });
        /* --- ACTUALIZACION EN APP WEB --- */
        io.sockets.emit("Tb", {
        value: data.value.value,
        timestamp: data.serverTimestamp,
        browseName: "Tb"
        });
      })
    },2000)

    setInterval(()=>{
      session.read(nodeToRead = {nodeId: "ns=1;i=1328", attributeId: AttributeIds.Value},(err, data)=>{
        /* --- ACTUALIZACION EN MONGO --- */
        collection.insertOne({
          Variable: "Te",
          valor: data.value.value, 
          tiempo: data.serverTimestamp
        });
        /* --- ACTUALIZACION EN APP WEB --- */
        io.sockets.emit("Te", {
        value: data.value.value,
        timestamp: data.serverTimestamp,
        browseName: "Te"
        });
      })
    },2000)


    monitoredItemP.on("changed", (dataValue) => {
      /* --- ACTUALIZACION EN MONGO --- */

      collection.insertOne({
        Variable: "P",
        valor: dataValue.value.value, 
        tiempo: dataValue.serverTimestamp
      });

      /* --- ACTUALIZACION EN APP WEB --- */

      io.sockets.emit("P", {
        value: dataValue.value.value,
        timestamp: dataValue.serverTimestamp,
        browseName: "P"
      });
    });
    
    monitoredItemI.on("changed", (dataValue) => {
      /* --- ACTUALIZACION EN MONGO --- */

      collection.insertOne({
        Variable: "I",
        valor: dataValue.value.value, 
        tiempo: dataValue.serverTimestamp
      });

      /* --- ACTUALIZACION EN APP WEB --- */

      io.sockets.emit("I", {
        value: dataValue.value.value,
        timestamp: dataValue.serverTimestamp,
        browseName: "I"
      });
    });

    monitoredItemD.on("changed", (dataValue) => {
      /* --- ACTUALIZACION EN MONGO --- */

      collection.insertOne({
        Variable: "D",
        valor: dataValue.value.value, 
        tiempo: dataValue.serverTimestamp
      });

      /* --- ACTUALIZACION EN APP WEB --- */

      io.sockets.emit("D", {
        value: dataValue.value.value,
        timestamp: dataValue.serverTimestamp,
        browseName: "D"
      });
    });

    /* --- REGISTRO DE ERRORES EN LA BASE DE DATOS --- */

    monitoredItemErr.on("changed", (dataValue) => {
      /* --- ACTUALIZACION EN MONGO --- */

      collection.insertOne({
        Variable: "Error",
        valor: dataValue.value.value, 
        tiempo: dataValue.serverTimestamp
      });
      io.sockets.emit("Error", {
        timestamp:dataValue.serverTimestamp,
        value:dataValue.value.value
      });
      event.emit("Error", {
        tiempo:dataValue.serverTimestamp,
        valor:dataValue.value.value
      });
    });

    /* --- FUNCION GLOBAL PARA INVOCAR METODO --- */

    Gcode = () => { 
      session.call([{
        objectId: "ns=1;i=1031",    // nodeId del componentOf
        methodId: "ns=1;i=1344",    // nodeIde del metodo
        inputArguments: [
          new Variant({dataType: DataType.String, value: gcodes})
        ]
      }],function(err,callResults) {
      if (!err) {
        const callResult = callResults[0];
      }});
    };


    /* --- SALIR AL PRESIONAR CTRL + C --- */

    let running = true;
    process.on("SIGINT", async () => {
      if (!running){
        return;   // avoid calling shutdown twice --------------------
      }
      console.log("shutting down client");
      running = false;
      await clientmongo.close();
      await subscription.terminate();
      await session.close();
      await client.disconnect();
      console.log("Done");
      process.exit(0);
    });
  }
  catch(err){
    /* --- CODIGO DE EJECUCION SI OCURRE UN ERROR EN EL BLOQUE TRY --- */

    console.log(bgRed.white("Error" + err.message));
    console.log(err);
    process.exit(-1);
  }
})();   //FUNCION EJECUTADA EN BUCLE



/* --- CREAR LA APLICACION WEB ---  */
/* --- CONSTANTES APP WEB ---*/

const port = 3000;
const app = express();

/* --- CONFIGURACIONES --- */

app.set('port', process.env.PORT || port);
app.set("view engine", "html");
app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.use(require('./PlataformaWeb/rutas/index'));

/*--- DIRECTORIOS ESTATICOS --- */ 

app.use(express.static(path.join(__dirname, 'PlataformaWeb')));
app.set('Views', __dirname + '/');

/* --- RENDERIZADO DE PAGINA INICIAL --- */

app.get("/", function(req,res){
  res.sendFile('index.html');
});


/* --- INICIAR SERVIDOR WEB --- */

const server = app.listen(app.get('port'), ()=> {
  console.log('server on port ', app.get('port'));
});

/* --- WEBSOCKETS --- */

const io = SocketIO(server);
io.on('connection', (socket) => {
  console.log('new conexion',socket.id);
  
  socket.on("Metodo",(data) => {
    gcodes = data.gcodes
    Gcode()
  });
});

/* --- MOSTRAR DIRECCION WEB --- */

console.log("visit http://localhost:" + port); 



/* --- NOTIFICADOR DE ERROR --- */
/* --- CREAR OBJETO REUTILIZABLE SMTP  --- */
let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'gomez.julian@correounivalle.edu.co', // generated ethereal user 
    pass: 'ovgr wuhq eahx yqhg', // generated ethereal password 
  },
});
event.on("Error", (data) => {
  var mailOptions = {
    from: 'gomez.julian@correounivalle.edu.co',
    to: 'julian-gomes@outlook.com',
    subject: 'Alarma prueba',
    html: `
    <h2>Se ha detectado una anomalia en su Impresora 3D. Si deseas autorizar una revision para garantizar su optimo funcionamiento u obtener mas información:</h2> 
    <h1><a href="http://localhost:3000/autorizacion.html">HAZ CLIC AQUI </a></h1>
    <h2>Por favor copie y pegue el siguiente valor en el formulario:<br>
    Fecha de la falla: ${data.tiempo}</h2>`
  };
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email enviado: ' + info.response);
    }
  });
})
