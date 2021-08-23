
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
        <h2>Si esta interesado tiene 15 minutos para aceptar el contrato dando clic en el siguiente link: http://localhost:3000/contrato.html </h2>
    `;
    
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'gomez.julian@correounivalle.edu.co', // generated ethereal user
        pass: 'gqwr xkdn xalw uyog', // generated ethereal password
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

estado = 'pendiente';

router.post('/contrato', (req,res) =>{

  const {respuesta} = req.body;
  if(respuesta == 'SI' && estado == 'pendiente'){
    res.sendFile('C:/Users/Laptop_J-Y/OneDrive - correounivalle.edu.co/Proyecto de grado/PG2/ProyectosIndustria4-Univalle/PlataformaVBS_Impresoras3D/PlataformaWeb/index.html');
    estado = 'aceptado';
  }
  else if(respuesta == 'SI' && estado == 'aceptado'){
    res.send('El contrato ya ha sido aceptado');
  }
  else{
    res.send('Recibido');
  }

});


module.exports = router;