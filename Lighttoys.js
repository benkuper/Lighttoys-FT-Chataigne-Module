var lastCheckTime = 0;

var nextOKisEndOfList = false;
var slaveCheckList = [];
for(var i=0;i<32;i++) slaveCheckList[i] = false;

function update()
{
	var time = util.getTime();

	if(time > lastCheckTime + 2) //check each second
	{
		lastCheckTime = time;

		//send list request
		nextOKisEndOfList = true;
		local.send("glist");
		for(var i=0;i<32;i++) slaveCheckList[i] = false;
	}

}


//Events
function dataReceived(data)
{

	if(data.substring(0,6) == "CMD>OK")
	{
		
		if(nextOKisEndOfList)
		{
			nextOKisEndOfList = false;
			
			for(var i=0;i<32;i++) 
			{
				if(!slaveCheckList[i]) local.values.connectedDevices.getChild("device"+i).set(0);
			}
		}	
		return;
	}

	if(data.substring(6,11) == "slave") 
	{
		var dataSplit = data.split(";");
		var propID = parseInt(dataSplit[1].substring(3,4));
		var isOn = dataSplit[7].substring(8,9) == "+";
		var voltageString = dataSplit[5];
		var voltage = parseInt(voltageString.substring(4,voltageString.length)) / 0x10000;
		slaveCheckList[propID] = isOn;
		lastSlaveFromList = propID;
		local.values.connectedDevices.getChild("device"+propID).set(isOn?voltage:0);
		return;
	}
/*
GRP>R:slave;LA:0;DA:0xE1A65D0A;RSSm2s:44;RSSs2m:44;VCC:804173;Temp:145;FL:IG---+;NMIS:0
FT Props : Message received : GRP>R:slave;LA:1;DA:0x48912D4B;RSSm2s:44;RSSs2m:44;VCC:819473;Temp:145;FL:IG---+;NMIS:0
*/

}



//Commands callbacks

function flashAll()
{
	script.log("Flash all !");
	local.send("gping 4292967295"); //this number is 2^32 - 1
}

function flash1(propID)
{
	var targetMask = 1 << propID;
	local.send("gping "+targetMask);
	script.log("Flash 1 prop, mask = "+targetMask);
}


function flashRange(startID, endID)
{
	var minID = Math.min(startID, endID);
	var maxID = Math.max(startID, endID);
	var targetMask = 0;

	for(var i=minID;i<=maxID;i++) targetMask += (1 << i);

	local.send("gping "+targetMask);
	script.log("Flash prop range, mask = "+targetMask);
}