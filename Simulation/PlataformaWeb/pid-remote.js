/*** 
CREACION DE VARIABLES PARA LAS GRAFICAS
 ***/

const socket = io();

/*** variables para los objetos de graficas ***/
let Pline = null;
let Pline2 = null;
let table;
/*** variables para los datos ***/
let data_line = [];
let data_line2 = [];
let data_table = [];
let arraySerial = [];
/*** obtener los canvas ***/
canvas1 = document.getElementById("cvs_line");
canvas2 = document.getElementById("cvs_line2");
readSerial = document.getElementById("readserial")

const numvalues = 200;
for (let i = 0; i < numvalues; ++i){data_line.push(null);data_line2.push(null)};
let flag = true;
/*** 
SE UTILIZA LA FUNCION ONLOAD PARA CREAR O INICIALIZAR
LAS GRAFICAS CUANDO SE CARGA LA PAGINA
 ***/
window.onload = function(){
    config = {
        xaxisLabels: ['','','','1 min','','','2 min','','','3 min','','','4 min','','','5 min','','','6 min'],
        xaxisTickmarksCount: 6,
        xaxis: true,
        yaxisScaleUnitsPost: ' °c',
        title: 'Tb vs t',
        titleBold: true,
        titleSize: 16,
        filled: false,
        colors: ['#3366CB'],
        marginLeft: 75,
        marginRight: 55,
        shadow: false,
        tickmarksStyle: 'circle',
        tickmarksSize: 2,
        backgroundGridVlines: true,
        textSize: 16,
        linewidth: 2,
    };
    config2 = Object.assign({}, config)
    config2.title = 'Te vs t'

    Pline = new RGraph.Line({
        id: 'cvs_line',
        data:data_line,
        options: config
    }).draw();
    Pline2 = new RGraph.Line({
        id: 'cvs_line2',
        data:data_line2,
        options: config2
    }).draw();

    table = new Tabulator("#alarm-table", {
        height:200,
        layout:"fitDataTable",
        columns:[
        {title:"Tiempo", field:"t"},
        {title:"Alarma", field:"a"},
        ],
    });
};
/*** 
FUNCIONES NECESARIAS PARA ACTUALIZAR LAS GRAFICAS
 ***/
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

function drawLine2(value){
    if (!Pline2){return}
    RGraph.Clear(canvas2);
    data_line2.push(value);
    if (data_line2.length > numvalues){
        data_line2 = RGraph.arrayShift(data_line2); // Esto descarta el primer valor del array
    }

    Pline2.original_data[0] = data_line2;
    Pline2.draw();
};

/*** 
CONECTAR AL SOCKET Y LEER EL MENSAJE
 ***/

socket.on("Tb", function(dataValue){
    drawLine(dataValue.value);
    AssetId = dataValue.Id;
    idAseet = document.getElementById("Id")
    ctx = idAseet.getContext("2d");
    ctx.font = "30px Arial";
    ctx.fillText(AssetId,100,50);
});

socket.on("Te", function(dataValue){
    drawLine2(dataValue.value);
});

socket.on("Error", function(dataValue){
    flag = false;
    data_table = table.getData();
    data_table.push({t:dataValue.timestamp, a:dataValue.value});
    table.setData(data_table);
})
socket.on("readserial", function(dataValue){
    getSerial = dataValue.value;
    arraySerial.push(getSerial);
    readSerial.innerHTML = arraySerial;
});

function obtener_Gcode(){
    let Gcode = document.getElementById("Gcodes")
    function borrartext(){
        Gcode.value = ''
    }
    socket.emit("Metodo", {
        gcodes: Gcode.value
    })
    borrartext()
}