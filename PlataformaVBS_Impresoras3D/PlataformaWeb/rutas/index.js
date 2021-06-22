
const {Router} = require("express");
var nodemailer = require('nodemailer');

const router = Router();

router.post('/autorizacion', (req,res) => {
    const {tipo, tiempo} = req.body;
    
    contentHTML = `
      <h1>Informacion de la falla </h1>
        <ul>
            <li>Tipo: ${tipo}</li>
            <li>Tiempo: ${tiempo}</li>
        </ul>
    `;
    
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'gomez.julian@correounivalle.edu.co', // generated ethereal user
        pass: 'yxcc lata kvmh wwze', // generated ethereal password
      },
    });
    
    var mailOptions = {
      from: 'gomez.julian@correounivalle.edu.co',
      to: 'julian-gomes@outlook.com',
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
    
    res.send('Recibido')
});


module.exports = router;