var lastCheckTime = 0;

var slaveCheckList = [];
var pairingMode = false;
var slaveListIndex = 0;

for(var i=0;i<32;i++) 
{
	slaveCheckList[i] = false;
}

function update()
{
	if(!pairingMode)
	{
		var time = util.getTime();

		if(time > lastCheckTime + 2) //check each second
		{
			lastCheckTime = time;

			//send list request
			slaveListIndex = 0;
			local.send("glist");
			for(var i=0;i<32;i++) slaveCheckList[i] = false;
		}
	}
	

}

function moduleParameterChanged(param)
{
	if(param.name == "pingAll")
	{
		flash("all",0,0,0);
	}else if(param.name == "addNewPairingGroup")
	{
		pairingMode = true;
		local.send("gadd 1");
		script.log("Start new pairing group");
	}else if(param.name == "addToGroup")
	{
		pairingMode = true;
		local.send("gadd 0");
		script.log("Pair new devices to the group");
	}else if(param.name == "finishPairing")
	{
		pairingMode = false;
		local.send("gstop");
		script.log("Finish pairing");
	}
}

//Events
function dataReceived(data)
{
	if(data.substring(0,3) == "GRP")
	{
		var dataSplit = data.split(";");
		var pairingTarget = dataSplit[0].substring(6,dataSplit[0].length);

		if(pairingTarget == "master")
		{
			local.values.connectedDevices.numPaired.set(parseInt(dataSplit[2].substring(5, dataSplit[2].length)));
		}else if(data.substring(6,11) == "slave") 
		{
			var dataSplit = data.split(";");
			var propID = parseInt(dataSplit[1].substring(3,dataSplit[1].length));
			var isOn = dataSplit[7].substring(8,9) == "+";
			var voltageString = dataSplit[5];
			var voltage = parseInt(voltageString.substring(4,voltageString.length)) / 0x10000;
			slaveCheckList[propID] = isOn;
			lastSlaveFromList = propID;
			local.values.connectedDevices.getChild("device"+propID).set(isOn?voltage:0);
			
			slaveListIndex++;
			if(slaveListIndex == local.values.connectedDevices.numPaired.get())
			{
				var numConnected = 0;
				for(var i=0;i<32;i++) 
				{
					if(!slaveCheckList[i]) local.values.connectedDevices.getChild("device"+i).set(0);
					else numConnected++;
				}

				local.values.connectedDevices.numConnected.set(numConnected);
			}
		}
	}
}


//Commands callbacks
function flash(target, propID, startID, endID)
{
	var targetMask = getMaskForTarget(target, propID, startID, endID);
	local.send("lstop "+targetMask);
	local.send("gping "+targetMask);
}

function color(target, propID, startID, endID, color)
{
	var targetMask = getMaskForTarget(target, propID, startID, endID);

	//Invert b and r because of inversion in the remote firmware 
	var b = parseInt(color[0]*255);
	var g = parseInt(color[1]*255);
	var r = parseInt(color[2]*255);

	local.send("leach "+targetMask+","+r+","+g+","+b+","+r+","+g+","+b);
}

function startShow(target, propID, startID, endID, showID, delay, startTime)
{
	var targetMask = getMaskForTarget(target, propId, startID, endID);
	local.send("sstart "+targetMask+","+(showID-1)+", "+parseInt(delay*1000)+", "+parseInt(startTime*1000)); //this number is 2^32 - 1
}

function stopShow(target, propID, startID, endID)
{
	var targetMask = getMaskForTarget(target, propId, startID, endID);
	local.send("sstop "+targetMask);
}


function blackOut(target, propID, startID, endID)
{
	var targetMask = getMaskForTarget(target, propId, startID, endID);
	local.send("leach "+targetMask+",0,0,0,0,0,0");
}


//Advanced functions
function gradient(startID, endID, color1, color2)
{
	
	if(startID == endID) 
	{
		color("one",startID,0,0,color1);
		return;
	}

	//Invert b and r because of inversion in the remote firmware 
	var b1 = color1[0];
	var g1 = color1[1];
	var r1 = color1[2];

	var b2 = color2[0];
	var g2 = color2[1];
	var r2 = color2[2];

	var targetMask = 0;
	var minID = Math.min(startID, endID);
	var maxID = Math.max(startID, endID);

	for(var i=minID;i<=maxID;i++)
	{
		var p = (i-minID)*1.0/(maxID-minID);

		var r = parseInt((r1+(r2-r1)*p)*255);
		var g = parseInt((g1+(g2-g1)*p)*255);
		var b = parseInt((b1+(b2-b1)*p)*255);

		targetMask = 1 << i;
		local.send("leach "+targetMask+","+r+","+g+","+b+","+r+","+g+","+b);
	} 
	
}

//Helpers
function getMaskForTarget(target, propID, startID, endID)
{
	if(target == "all") return 1099511627775;
	else if(target == "one") return 1 << propID;
	else if(target == "range") 
	{
		var targetMask = 0;
		var minID = Math.min(startID, endID);
		var maxID = Math.max(startID, endID);
		for(var i=minID;i<=maxID;i++) targetMask += (1 << i);
		return targetMask;
	}

	return 0;
}