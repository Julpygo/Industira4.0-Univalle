/*--- IMPORTACION DE MODULOS --- */
const { OPCUAClient, AttributeIds, TimestampsToReturn, Variant, DataType} = require("node-opcua");
const MongoClient = require('mongodb').MongoClient;
const {cyan, bgRed, yellow} = require("chalk");
const SocketIO = require('socket.io');
const express = require("express");
const path = require('path');
var nodemailer = require('nodemailer');
var fs = require('fs');
var EventEmitter = require('events')

/* --- CREACION DE VARIABLES INICIALES --- */
var event = new EventEmitter();
gcodes = 'inicial';

/* --- CONSTANTES DEL SERVIDOR UA ---*/
const endpointUrl = "opc.tcp://" + require("os").hostname() + ":4334/UA/ImpresoraServer";
const nodeIdToMonitorTb = "ns=1;i=1194";   //Tb
const nodeIdToMonitorTe = "ns=1;i=1195";   //Te

/* --- CONSTASTES MONGO DB ---*/
const uri = "mongodb+srv://lianju:Yuligb1996@cluster0.z4spe.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
const clientmongo = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true});


/* --- CLIENTE UA --- */
(async () => {
  try {
    /* --- CREAR CLIENTE UA --- */
    const client = OPCUAClient.create();

    /* --- INFORMACION DE RECONEXION --- */
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

    /* --- INICIO DEL MONITOREO DE VARIABLES UA --- */
    
    /* --- DEFINIR ITEMS MONITOREABLES --- */
    const itemToMonitorTb = {nodeId: nodeIdToMonitorTb, AttributeIds: AttributeIds.Value};
    const itemToMonitorTe = {nodeId: nodeIdToMonitorTe, AttributeIds: AttributeIds.Value};

    /* --- FUNCION GLOBAL PARA INVOCAR METODO --- */
    Gcode = () => { 
      session.call([{
        objectId: "ns=1;i=1051",    // nodeId del componentOf
        methodId: "ns=1;i=1206",    // nodeIde del metodo
        inputArguments: [
          new Variant({dataType: DataType.String, value: gcodes})
        ]
      }],function(err,callResults) {
      if (!err) {
        const callResult = callResults[0];
      }});
    };
    /* --- */

    /* --- DEFINIR PARAMETROS DE MONITOREO --- */
    const parameters = {
      samplingInterval: 50,   //tiempo de muestreo 
      discardOldest: true,    //descartar datos anteriores 
      queueSize: 100          //tamaño de la cola de datos 
    };

    /* --- INICIAR MONITOREO POR SUBSCRIBCION --- */
    const monitoredItemTb = await subscription.monitor(itemToMonitorTb, parameters, TimestampsToReturn.Both);
    const monitoredItemTe = await subscription.monitor(itemToMonitorTe, parameters, TimestampsToReturn.Both);

    /* --- CONEXION A LA BASE DE DATOS --- */
    await clientmongo.connect();
    const collection = clientmongo.db("VarImpresora3D").collection("Historial de datos");

    /* --- ACTUALIZACION DE VARIABLES --- */
    
    monitoredItemTb.on("changed", (dataValue) => {
      /* --- ACTUALIZACION EN MONGO --- */
      collection.insertOne({
        Variable: "Tb",
        valor: dataValue.value.value, 
        tiempo: dataValue.serverTimestamp
      });

      /* --- ACTUALIZACION EN APP WEB --- */
      io.sockets.emit("Tb", {
        value: dataValue.value.value,
        timestamp: dataValue.serverTimestamp,
        nodeId: nodeIdToMonitorTb,
        browseName: "Tb"
      });
    });

    monitoredItemTe.on("changed", (dataValue) => {
      /* --- ACTUALIZACION EN MONGO --- */
      collection.insertOne({
        Variable: "Te",
        valor: dataValue.value.value, 
        tiempo: dataValue.serverTimestamp
      });

      /* --- ACTUALIZACION EN APP WEB --- */
      io.sockets.emit("Te", {
        value: dataValue.value.value,
        timestamp: dataValue.serverTimestamp,
        nodeId: nodeIdToMonitorTe,
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


/* --- NOTIFICADOR --- */

/* --- CREAR OBJETO REUTILIZABLE SMTP  --- */
// let transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: 'gomez.julian@correounivalle.edu.co', // generated ethereal user 
//     pass: 'gqwr xkdn xalw uyog', // generated ethereal password 
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
