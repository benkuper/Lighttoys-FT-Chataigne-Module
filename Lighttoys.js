var lastCheckTime = 0;

var slaveCheckList = [];
var pairingMode = false;
var colors = [];

var updateRate = local.parameters.updateRate.get() == 0?0:1.0 / local.parameters.updateRate.get();
var alwaysUpdate = local.parameters.alwaysUpdate.get();
var lastUpdateTime = 0;

for(var i=0;i<32;i++) 
{
	colors[i] = [0,0,0];
	slaveCheckList[i] = false;
}

function update()
{
	if(!local.parameters.isConnected.get()) return;
	
	if(!pairingMode)
	{
		var time = util.getTime();

		if(time > lastCheckTime + 5) //check every 5 seconds
		{
			lastCheckTime = time;

			//send list request
			for(var i=0;i<32;i++) slaveCheckList[i] = false;
			local.send("glist");
			
		}

		if(alwaysUpdate && time > lastUpdateTime+updateRate)
		{
			lastUpdateTime = time;
			sendAllColors();

		}
	}
}

function sendAllColors()
{
	var numPaired = local.values.connectedDevices.numPaired.get();
	var numConnected = local.values.connectedDevices.numConnected.get();

	for(var i=0;i<numPaired;i++)
	{
		//if(!slaveCheckList[i]) continue; //not connected
		var r = colors[i][0];
		var g = colors[i][1];
		var b = colors[i][2];
		var targetMask = 1 << i;
		local.send("leach "+targetMask+","+r+","+g+","+b+","+r+","+g+","+b);
	}
	
}

function moduleParameterChanged(param)
{
	if(param.name == "pingAll")
	{
		ping("all",0,0,0);
	}else if(param.name == "blackOut")
	{
		blackOut("all",0,0,0);
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
	}else if(param.name == "updateRate")
	{
		updateRate = param.get() == 0?0:1.0/param.get();
		script.log("new update rate : "+updateRate);
	}else if(param.name == "alwaysUpdate")
	{
		alwaysUpdate = local.parameters.alwaysUpdate.get();
	}else if(param.name == "isConnected")
	{

	}else if(param.getParent().name == "deviceNames")
	{
		var propID = parseInt(param.name.substring(6, param.name.length));
		var propMask = getMaskForTarget("one",propID,0,0);
		script.log("Changing of Device "+propID+" to "+param.get());
		local.send("gname "+propMask+","+param.get());
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
		}else if(pairingTarget == "slave") 
		{
			var propID = parseInt(dataSplit[1].substring(3,dataSplit[1].length));
			var isOn = dataSplit[7].substring(8,9) == "+";
			var voltageString = dataSplit[5];
			var voltage = parseInt(voltageString.substring(4,voltageString.length)) / 0x10000;
			slaveCheckList[propID] = isOn;
			local.values.connectedDevices.getChild("device"+propID).set(isOn?voltage:0);
			
			local.send("gname "+getMaskForTarget("one",propID,0,0));

			if(propID == local.values.connectedDevices.numPaired.get()-1)
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
	}else if(data.substring(0,3) == "UDN")
	{
		var dataSplit = data.split(";");
		var propIDMask = parseInt(dataSplit[0].substring(7, dataSplit[0].length));
		var propName = dataSplit[1].substring(3, dataSplit[1].length-2);
		var propID = 0;
		while(propIDMask > 1)
		{
			propID++;
			propIDMask /= 2;
		} 
		local.parameters.deviceNames.getChild("device"+propID).set(propName);

	}
}


//Commands callbacks
function ping(target, propID, startID, endID)
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

	var col = [r,g,b];

	if(target == "one") 
	{
		colors[propID] = col;
	}
	else if(target == "range")
	{
		var minID = Math.min(startID, endID);
		var maxID = Math.max(startID, endID);
		for(var i=minID;i < maxID;i++) colors[i] = col;
	}else if(target == "all") 
	{
		for(var i=0;i<32;i++) colors[i] = col;
	}

	if(!alwaysUpdate) 
	{
		if(!local.parameters.isConnected.get()) return;
		local.send("leach "+targetMask+","+r+","+g+","+b+","+r+","+g+","+b);
	}
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
	for(var i=0;i<31;i++) colors[i] = [0,0,0];

	if(!alwaysUpdate)
	{
		if(!local.parameters.isConnected.get()) return;
		var targetMask = getMaskForTarget(target, propId, startID, endID);
		local.send("leach "+targetMask+",0,0,0,0,0,0");
	}
	
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

		colors[i] = [r,g,b];

		
		if(!alwaysUpdate) 
		{
			if(!local.parameters.isConnected.get()) return;
			targetMask = 1 << i;
			local.send("leach "+targetMask+","+r+","+g+","+b+","+r+","+g+","+b);
		}
	} 
	
}

function point(startID, endID, position, size, fade, color)
{
	var b = color[0];
	var g = color[1];
	var r = color[2];

	for(var i=startID;i<=endID;i++)
	{
		var p = (i-startID)*1.0/(endID-startID);

		if(Math.abs(position-p) < size) 
		{
			var fac = Math.min(Math.max(1-Math.abs((p-position)*fade*3/size),0),1);
			colors[i] = [parseInt(r*fac*255), parseInt(g*fac*255), parseInt(b*fac*255)];
		}
		else colors[i] = [0,0,0];
	}

	if(!alwaysUpdate)
	{
		if(!local.parameters.isConnected.get()) return;
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