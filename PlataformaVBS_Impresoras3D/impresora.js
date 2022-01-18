const SerialPort = require('serialport');

const port = new SerialPort(
    "COM2",
    {baudRate: 115200}
)

const parser = new SerialPort.parsers.Readline()

port.pipe(parser)

parser.on('data', (line)=>{
    console.log(line);  
});
contador = 1;

// setTimeout(()=>{port.write("Error:Heating failed, system stopped! Heater_ID: 0\r\n")},8000)
// setTimeout(()=>{port.write("Error:Printer halted. kill() called!\r\n")},20000)
setInterval(()=>{
    contador++;
    var Te = Math.exp(contador/30);
    var Tb = Math.exp(contador/40);
    port.write(`T:${Te} /0.00 B:${Tb} /60.00 @:0 B@:127\r\n`)
    console.log(`T:${Te} /0.00 B:${Tb} /60.00 @:0 B@:127\r\n`);
},2000)