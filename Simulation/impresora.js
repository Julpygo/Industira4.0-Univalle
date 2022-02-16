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

// setTimeout(()=>{port.write("Error:Heating failed, system stopped! Heater_ID: 0\r\n"), console.log("Error:Heating failed, system stopped! Heater_ID: 0\r\n");},2000)
// setTimeout(()=>{port.write("Error:Printer halted. kill() called!\r\n"), console.log("Error:Printer halted. kill() called!\r\n");},8000);
// setTimeout(()=>{port.write("echo:  M301 P28.47 I2.76 D114.87\r\n"), console.log("echo:  M301 P28.47 I2.76 D114.87");},8000);
setTimeout(()=>{port.write("echo:  M302 P28 I2 D114\r\n"), console.log("echo:  M301 P28 I2 D114");},15000);
setTimeout(()=>{port.write("echo:  M303 P28 I2 D114\r\n"), console.log("echo:  M301 P28 I2 D114");},16000);
setTimeout(()=>{port.write("echo:  M304 P28 I2 D114\r\n"), console.log("echo:  M301 P28 I2 D114");},17000);
setTimeout(()=>{port.write("echo:  M305 P28 I2 D114\r\n"), console.log("echo:  M301 P28 I2 D114");},18000);
setTimeout(()=>{port.write("echo:  M306 P28 I2 D114\r\n"), console.log("echo:  M301 P28 I2 D114");},19000);
setInterval(()=>{
    contador++;
    var Te = Math.exp(contador/30).toFixed(2)
    var Tb = Math.exp(contador/40).toFixed(2)
    port.write(`T:${Te} /180.00 B:${Tb} /60.00 @:0 B@:127\r\n`);
    console.log(`T:${Te} /180.00 B:${Tb} /60.00 @:0 B@:127`);
},2000);


