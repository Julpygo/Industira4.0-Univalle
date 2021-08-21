const { Router } = require('express');
const router = Router();
var nodemailer = require('nodemailer');

disponible = 'si'
transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'gomez.julian@correounivalle.edu.co', // generated ethereal user
    pass: 'gqwr xkdn xalw uyog', // generated ethereal password
  },
});

router.post('/autorizacion', (req, res) => {
    const {respuesta, tipo, tiempo} = req.body;

    contentHTML = `
        <h1>Informacion de la falla</h1>
        <ul>
            <li>respuesta: ${respuesta}</li>
            <li>tipo: ${tipo}</li>
            <li>tiempo: ${tiempo}</li>
        </ul>
        <h2>para aceptar el contrato da clic en el siguiente enlace: http://localhost:3000/contrato.html <h2>
        <h2>Para accedar a la base de datos en mongo db utilice la siguiente clave de api: hbpdvmtc <h2>
        <h2>Ingrese a la plataforma para gestionar la falla con el siguiente link: http://localhost:3000/
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
});

router.post('/contrato', (req, res) =>{
  const {respuesta2} = req.body;
  console.log(respuesta2);
  if (respuesta2 === 'SI' & disponible === 'si'){
    disponible = 'no'
    res.send("Recibido")
    setTimeout(()=>{ 
      contentHTML2 = `
        <h2>Despues de realizar el diagnostico 
        por favor realice la siguiente encuesta: http://localhost:3000/contrato.html <h2>
    `;
      var mailOptions2 = {
          from: 'gomez.julian@correounivalle.edu.co',
          to: 'gomez.julian@correounivalle.edu.co',
          subject: 'Encuesta',
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


module.exports = router;