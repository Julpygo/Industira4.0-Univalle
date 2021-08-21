const { Router } = require('express');
const router = Router();
var nodemailer = require('nodemailer');

disponible = 'si'

router.post('/autorizacion', (req, res) => {
    const {respuesta, tipo, tiempo} = req.body;

    contentHTML = `
        <h1>Informacion de la falla</h1>
        <ul>
            <li>respuesta: ${respuesta}</li>
            <li>tipo: ${tipo}</li>
            <li>tiempo: ${tiempo}</li>
        </ul>
        <h2>para aceptar el contrato da clic en el siguiente enlace http://localhost:3000/contrato.html <h2>
    `;
    console.log(contentHTML);

    res.send('recibido');
    
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'gomez.julian@correounivalle.edu.co', // generated ethereal user
          pass: 'gqwr xkdn xalw uyog', // generated ethereal password
        },
      });
      
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
  }
  else if (respuesta2 === 'SI' & disponible === 'no'){
    res.send("Este contrato ya ha sido aceptado")
  }
  else {
    res.send("recibido")
  }
});


module.exports = router;