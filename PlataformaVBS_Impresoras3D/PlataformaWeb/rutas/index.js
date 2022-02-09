const { Router } = require('express');
const router = Router();
var nodemailer = require('nodemailer');

disponible = 'si'
transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'gomez.julian@correounivalle.edu.co', // generated ethereal user
    pass: 'mgvm jraj lkii ddsq', // generated ethereal password
  },
});

router.post('/autorizacion', (req, res) => {
    const {respuesta, FallaId, ti_revision, tf_revision} = req.body;
    ti =  new Date(ti_revision);
    tf = new Date(tf_revision);
    Id = FallaId.slice(0,FallaId.search("-"));
    Falla = FallaId.slice(FallaId.search("-")+1,FallaId.search("_"));
    fecha = FallaId.slice(FallaId.search("_")+1,)

    if(respuesta === 'SI'){
      contentHTML = `
          <h1>EL cliente de la impresora <p style="color:#FF0000";>${Id}</p> ha solicitado un servicio tecnico debido a la falla <p style="color:#FF0000";>${Falla}</p> ocurrida
          el <p style="color:#FF0000";>${fecha}</p> El horario disponible para revision de la maquina es <p style="color:#FF0000";>${ti}</p> hasta <p style="color:#FF0000";>${tf}</p></h1>
          <h2>para aceptar el contrato: <a href="http://localhost:3000/contrato.html">HAZ CLIC AQUI</a><h2>
          <h2>Para accedar a la base de datos en mongo db: <a href="https://charts.mongodb.com/charts-project-platform-vbs-qppvf/public/dashboards/fda74be7-3fcf-4f99-b819-edc3a74265c0"> CLIC AQUI </a> <h2>
          <h2>Ingrese a la plataforma para gestionar la falla <a href="http://localhost:3000/">CLIC AQUI</a></h2>
      `;
      res.send('recibido');
      
      var mailOptions = {
        from: 'gomez.julian@correounivalle.edu.co',
        to: 'gomez.julian@correounivalle.edu.co',
        subject: 'Reporte de falla',
        html: contentHTML
      };
      
      transporter.sendMail(mailOptions, function(error, info){
          if (error) {
            console.log(error);
          } else {
            console.log('Email enviado: ' + info.response);
          }
      });
    }
    else {
      res.send('Recibido')
    }
});

router.post('/contrato', (req, res) =>{
  const {respuesta2} = req.body;
  console.log(respuesta2);
  if (respuesta2 === 'SI' & disponible === 'si'){
    disponible = 'no'
    res.send("Recibido")
    setTimeout(()=>{ 
      contentHTML2 = `
        <h2>Despues de realizar el servicio, debe llenar el siguiente formulario: <a href="http://localhost:3000/Reporte.html">CLIC AQUI</a>
        El registro de falla solicitado es el siguiente: <h2 style="color:#FF0000";>${Id}${Falla}${fecha}<h2><h2>
    `;
      var mailOptions2 = {
          from: 'gomez.julian@correounivalle.edu.co',
          to: 'gomez.julian@correounivalle.edu.co',
          subject: 'Reporte del servicio',
          html: contentHTML2
      };
      
      transporter.sendMail(mailOptions2, function(error, info){
          if (error) {
            console.log(error);
          } else {
            console.log('Email enviado: ' + info.response);
          }
      });
    },9000);
  }
  else if (respuesta2 === 'SI' & disponible === 'no'){
    res.send("Este contrato ya ha sido aceptado")
  }
  else {
    res.send("recibido")
  }
});

router.post('/reporte', (req, res) => {
  res.send("recibido");
  contentHTML3 = `
        <h2>Por favor realice la siguiente encuesta para evaluar el servicio prestado. <a href="http://localhost:3000/encuesta.html">CLIC AQUI</a>
        El registro de falla solicitado es el siguiente: <h2 style="color:#FF0000";>${Id}${Falla}${fecha}<h2><h2>
    `;
  var mailOptions3 = {
      from: 'gomez.julian@correounivalle.edu.co',
      to: 'julian-gomes@outlook.com',
      subject: 'Encuesta',
      html: contentHTML3
  };
  
  transporter.sendMail(mailOptions3, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email enviado: ' + info.response);
      }
    });
});

router.post('/encuesta', (req, res) => {
  res.send("recibido")
});



module.exports = router;