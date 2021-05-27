/* 
CREACION DE VARIABLES PARA LAS GRAFICAS
 */

const socket = io();

// variables para los objetos de graficas
let Pline = null;
let Gauge1 = null;
let table;
// variables para los datos
let data_line = [];
let data_table = [];
// obtener los canvas
canvas1 = document.getElementById("cvs_line");

const numvalues = 200;
for (let i = 0; i < numvalues; ++i){data_line.push(null);};
let flag = true;
/* 
SE UTILIZA LA FUNCION ONLOAD PARA CREAR O INICIALIZAR
LAS GRAFICAS CUANDO SE CARGA LA PAGINA
 */
window.onload = function(){
     // Parametrizar la grafica
     Pline = new RGraph.Line({
          id: 'cvs_line',
          data:data_line,
          options: {
               xaxisLabels: ['Aug 13, 2012','Sep 9 2013','Oct 6 2014'],
               marginLeft: 75,
               marginRight: 55,
               filled: true,
               filledColors: ['#C2D1F0'],
               colors: ['#3366CB'],
               shadow: false,
               tickmarksStyle: null,
               xaxisTickmarksCount: 0,
               backgroundGridVlines: false,
               backgroundGridBorder: false,
               xaxis: false,
               textSize: 16
          }
     }).draw();

     Gauge1 = new RGraph.Gauge({
        id: 'cvs_gauge',
        min: 0,
        max: 50,
        value: 0, // valor inicial
        options: {
            centery: 120,
            radius: 130,
            anglesStart: RGraph.PI,
            anglesEnd: RGraph.TWOPI,
            needleSize: 85,
            borderWidth: 0,
            shadow: false,
            needleType: 'line',
            colorsRanges: [[0,10,'yellow'], [10,20,'#0f0'],[20,50,'red']],
            borderInner: 'rgba(0,0,0,0)',
            borderOuter: 'rgba(0,0,0,0)',
            borderOutline: 'rgba(0,0,0,0)',
            centerpinColor: 'rgba(0,0,0,0)',
            centerpinRadius: 0
        }
    }).grow();

    table = new Tabulator("#alarm-table", {
        height:200,
        layout:"fitColumns",
        columns:[
        {title:"Time", field:"t"},
        {title:"Valor", field:"v", sorter:"number"},
        {title:"Alarma", field:"a"},
        ],
    });
};
/* 
FUNCIONES NECESARIAS PARA ACTUALIZAR LAS GRAFICAS
 */
function drawLine(value){
    if (!Pline){return}
    RGraph.Clear(canvas1);
    data_line.push(value);
    if (data_line.length > numvalues){
        data_line = RGraph.arrayShift(data_line); // Estoy descarta el primer valor del array
    }

    Pline.original_data[0] = data_line;
    Pline.draw();
};

/* 
CONECTAR AL SOCKET Y LEER EL MENSAJE
 */
// conexion

socket.on("message", function(dataValue){
    drawLine(dataValue.value);
    Gauge1.value = dataValue.value;
    Gauge1.grow();

    if (dataValue.value > 45 && flag == true){
        // agregar la alarma a la tabla y cambiar la bandera
        flag = false;
        data_table = table.getData();
        data_table.push({t:dataValue.timestamp, v:dataValue.value, a:"Valor muy alto"});
        table.setData(data_table);
    } else if (flag == false && dataValue.value < 45){
        flag = true;
    };
});
// atender el evento