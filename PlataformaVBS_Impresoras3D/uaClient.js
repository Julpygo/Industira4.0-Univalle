/* 
IMPORTACION DE MODULOS, DEBEN ESTAR PREVIAMENTE INSTALADOS
 */
const { OPCUAClient, AttributeIds, TimestampsToReturn, ClientAlarm} = require("node-opcua");
const MongoClient = require('mongodb').MongoClient;
const {cyan, bgRed, yellow} = require("chalk");
const SocketIO = require('socket.io');
const express = require("express");
const path = require('path');

var nodemailer = require('nodemailer');
var fs = require('fs')
var EventEmitter = require('events')

var event = new EventEmitter();


/* 
CREACION DE CONSTANTES PARA LA COMUNICACION Y LA BASE DE DATOS
 */

//opc ua
const endpointUrl = "opc.tcp://" + require("os").hostname() + ":4334/UA/ImpresoraServer";
const nodeIdToMonitor = "ns=1;i=1056";    //pos x
const nodeIdToMonitor2 = "ns=1;i=1092";   //pos y
const nodeIdToMonitor3 = "ns=1;i=1126";   //pos z
const nodeIdToMonitor4 = "ns=1;i=1045";   //Tb
const nodeIdToMonitor5 = "ns=1;i=1046";   //Te

//aplicacion web
const port = 3000;

//mongo db
const uri = "mongodb+srv://lianju:Yuligb1996@cluster0.z4spe.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
const clientmongo = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true});


/* 
EL CODIGO PRINCIPAL VA EN LA FUNCION ASYNC
 */

(async () => {    //await
  try {
    // crear cliente opc ua
    const client = OPCUAClient.create();

    // avisar cuando se esta intentando reconectar
    client.on("backoff", (retry, delay) => {
      console.log("Intentando conectarse a ", endpointUrl,
      ": Intento =", retry,
      "próximo intento en ", delay / 1000, "segundos")
    });

    // mostrar la url cuando se logre conectar
    console.log(" Conectando a ", cyan(endpointUrl));
    await client.connect(endpointUrl);
    console.log(" Conectado a ", cyan(endpointUrl));

    // iniciar la sesion para interactuar con el servidor opc ua
    const session = await client.createSession();
    console.log(yellow("Sesion iniciada"));

    // crear una sucripcion
    const subscription = await session.createSubscription2({
      requestedPublishingInterval: 200,   //intervalo de tiempo en el cual se publica la solicitud
      requestedMaxKeepAliveCount: 20,     //intentos maximos para recuperar la conexion
      publishingEnabled: true,            //habilitar la publicacion
    });

    /* 
    SE INICIA EL MONITOREO DE LA VARIABLE DEL SERVIDOR OPC UA
     */
    
    // crear el item con su nodeId y atributo
    const itemToMonitor = {
      nodeId: nodeIdToMonitor,
      AttributeIds: AttributeIds.Value
    };
    const itemToMonitor2 = {
      nodeId: nodeIdToMonitor2,
      AttributeIds: AttributeIds.Value
    };
    const itemToMonitor3 = {
      nodeId: nodeIdToMonitor3,
      AttributeIds: AttributeIds.Value
    };
    const itemToMonitor4 = {
      nodeId: nodeIdToMonitor4,
      AttributeIds: AttributeIds.Value
    };
    const itemToMonitor5 = {
      nodeId: nodeIdToMonitor5,
      AttributeIds: AttributeIds.Value
    };
    
    // definir los parametros de monitoreo
    const parameters = {
      samplingInterval: 50,   //tiempo de muestreo
      discardOldest: true,    //descartar datos anteriores
      queueSize: 100          //tamaño de la cola de datos
    };

    // crear el objeto de monitoreo 
    const monitoredItem = await subscription.monitor(itemToMonitor, parameters, TimestampsToReturn.Both);
    const monitoredItem2 = await subscription.monitor(itemToMonitor2, parameters, TimestampsToReturn.Both);
    const monitoredItem3 = await subscription.monitor(itemToMonitor3, parameters, TimestampsToReturn.Both);
    const monitoredItem4 = await subscription.monitor(itemToMonitor4, parameters, TimestampsToReturn.Both);
    const monitoredItem5 = await subscription.monitor(itemToMonitor5, parameters, TimestampsToReturn.Both);

    /* 
    CONEXION A LA BASE DE DATOS
     */

    // conectar al cliente
    await clientmongo.connect();

    // conectarse a la coleccion con los datos del mongodb atlas
    const collection = clientmongo.db("VarImpresora3D").collection("Historial de datos");

    /* 
    DEFINIMOS QUE HACER CUANDO LA VARIABLE MONITOREADA CAMBIE
     */
    monitoredItem.on("changed", (dataValue) => {
      //escribir valor en mongo
      collection.insertOne({
        Variable: "Pos x",
        valor: dataValue.value.value, 
        tiempo: dataValue.serverTimestamp
      });
      io.sockets.emit("PosX", {
        value: dataValue.value.value,
        timestamp: dataValue.serverTimestamp,
        nodeId: nodeIdToMonitor,
        browseName: "Pos x"
      });
    });
    
    monitoredItem2.on("changed", (dataValue) => {
      //escribir valor en mongo
      collection.insertOne({
        Variable: "Pos y",
        valor: dataValue.value.value, 
        tiempo: dataValue.serverTimestamp
      });
      io.sockets.emit("PosY", {
        value: dataValue.value.value,
        timestamp: dataValue.serverTimestamp,
        nodeId: nodeIdToMonitor,
        browseName: "Pos y"
      });
    });

    monitoredItem3.on("changed", (dataValue) => {
      //escribir valor en mongo
      collection.insertOne({
        Variable: "Pos z",
        valor: dataValue.value.value, 
        tiempo: dataValue.serverTimestamp
      });
      io.sockets.emit("PosZ", {
        value: dataValue.value.value,
        timestamp: dataValue.serverTimestamp,
        nodeId: nodeIdToMonitor,
        browseName: "Pos z"
      });
    });
    
    monitoredItem4.on("changed", (dataValue) => {
      //escribir valor en mongo
      collection.insertOne({
        Variable: "Tb",
        valor: dataValue.value.value, 
        tiempo: dataValue.serverTimestamp
      });
      io.sockets.emit("Tb", {
        value: dataValue.value.value,
        timestamp: dataValue.serverTimestamp,
        nodeId: nodeIdToMonitor,
        browseName: "Tb"
      });
    });

    monitoredItem5.on("changed", (dataValue) => {
      //escribir valor en mongo
      collection.insertOne({
        Variable: "Te",
        valor: dataValue.value.value, 
        tiempo: dataValue.serverTimestamp
      });
      io.sockets.emit("Te", {
        value: dataValue.value.value,
        timestamp: dataValue.serverTimestamp,
        nodeId: nodeIdToMonitor,
        browseName: "Te"
      });
      if ((dataValue.value.value) > 49){
        var logger = fs.createWriteStream('log.txt', {
          flags: 'a' // 'a' means appending (old data will be preserved)
        })
        logger.write(`{var:"T del extrusor" , t:${dataValue.serverTimestamp}, v:${dataValue.value.value}, a:"Valor muy alto"},`) // append string to your file
        logger.end() // close string
        event.emit("Alarm Te", {
          tiempo:dataValue.serverTimestamp,
          valor:dataValue.value.value,
          tipo: "Te"
      });
      }
    });



    /* 
    SALIR AL PRESIONAR CTRL + C
     */
    let running = true;
    process.on("SIGINT", async () => {
      if (!running){
        return;   // avoid calling shutdown twice
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
    /* 
    CODIGO DE EJECUCION SI OCURRE UN ERROR EN EL BLOQUE TRY
     */
    console.log(bgRed.white("Error" + err.message));
    console.log(err);
    process.exit(-1);
  }
})();   //La funcion se estara ejecutando


/* 
CREAR LA APLICACION WEB
  */

const app = express();

// configuraciones
app.set('port', process.env.PORT || port);
app.set("view engine", "html");

app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.use(require('./PlataformaWeb/rutas/index'));

// definir el directorio de estaticos
app.use(express.static(path.join(__dirname, 'PlataformaWeb')));
app.set('Views', __dirname + '/');

// Que hacer cuando se solicite desde el navegador
app.get("/", function(req,res){
  res.sendFile('index.html');
});


// Iniciar server
const server = app.listen(app.get('port'), ()=> {
  console.log('server on port ', app.get('port'));
});

// websockets
const io = SocketIO(server);

io.on('connection', (socket) => {
  console.log('new conexion',socket.id);
});

// mostrar el url para entrar a la aplicacion web
console.log("visit http://localhost:" + port); 


// NOTIFICADOR

// crear un objeto transportador reutilizable utilizando el transporte SMTP predeterminado

// let transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: 'gomez.julian@correounivalle.edu.co', // generated ethereal user
//     pass: 'yxcc lata kvmh wwze', // generated ethereal password
//   },
// });

// event.on("Alarm Te", (data) => {
//   var mailOptions = {
//     from: 'gomez.julian@correounivalle.edu.co',
//     to: 'julian-gomes@outlook.com',
//     subject: 'Alarma prueba',
//     text: `
//     Se ha detectado una anomalia en su Impresora 3D.
//     Si deseas autorizar una revision de esta para garantizar su
//     optimo funcionamiento u obtener mas información. 
    
//     HAZ CLIC EN EL SIGUIENTE ENLACE  http://localhost:3000/autorizacion.html
//     Los datos pedidos en el enlace son los siguientes:
//     Tipo: ${data.tipo}, Tiempo: ${data.tiempo}`
//   };

//   transporter.sendMail(mailOptions, function(error, info){
//     if (error) {
//       console.log(error);
//     } else {
//       console.log('Email enviado: ' + info.response);
//     }
//   });
// })
