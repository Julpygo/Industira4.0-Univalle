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

setTimeout(()=>{port.write("Error:Heating failed, system stopped! Heater_ID: 0\r\n")},10000)
setTimeout(()=>{port.write("Error:Printer halted. kill() called!\r\n")},15000)
// setTimeout(()=>{port.write("T:21.17 /0.00 B:22.46 /60.00 @:0 B@:127\r\n")},8000)
