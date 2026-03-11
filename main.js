const fs = require("fs");

// convert "hh:mm:ss am/pm" → seconds
function time12ToSeconds(t) {
    let [time, period] = t.split(" ");
    let timeSplit = time.split(":").map(Number);
  
    let hour = timeSplit[0];
    let minute = timeSplit[1];
    let second = timeSplit[2];
  
    if (period === "pm" && hour !== 12) {
      hour += 12;
    }
  
    if (period === "am" && hour === 12) {
      hour = 0;
    }
  
    return hour * 3600 + minute * 60 + second;
  }

function timeToSeconds(t) {
  let time = t.split(":").map(Number);
  const hour = time[0];
  const minute = time[1];
  const second = time[2];
  return hour * 3600 + minute * 60 + second;
}


function secondsToTime(sec) {
  let h = Math.floor(sec / 3600);
  sec %= 3600;
  let m = Math.floor(sec / 60);
  let s = sec % 60;

 if (m < 10) m = "0" + m;
if (s < 10) s = "0" + s;

return [h, m, s].join(":");
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
  let startSeconds = time12ToSeconds(startTime);
  let endSeconds = time12ToSeconds(endTime);

  if (endSeconds < startSeconds) {
    endSeconds = endSeconds + 24 * 3600;
  }
   
  return secondsToTime(endSeconds - startSeconds);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
  let start = time12ToSeconds(startTime);
  let end = time12ToSeconds(endTime);

  if (end < start) end += 24 * 3600;

  let deliveryStart = 8 * 3600;
  let deliveryEnd = 22 * 3600;

  let idle = 0;

  if (start < deliveryStart) idle += Math.min(end, deliveryStart) - start;

  if (end > deliveryEnd) idle += end - Math.max(start, deliveryEnd);

  return secondsToTime(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
  let shift = timeToSeconds(shiftDuration);
  let idle = timeToSeconds(idleTime);

  return secondsToTime(shift - idle);
}


// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
  let active = timeToSeconds(activeTime);

  let eidStart = new Date("2025-04-10");
  let eidEnd = new Date("2025-04-30");

  let d = new Date(date);

  let quota = d >= eidStart && d <= eidEnd ? 6 * 3600 : 8 * 3600 + 24 * 60;

  return active >= quota;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
  let data = fs.readFileSync(textFile,"utf8").trim().split("\n");

  for (let i=1;i<data.length;i++){
    let p = data[i].split(",");
    if (p[0]===shiftObj.driverID && p[2]===shiftObj.date) return {};
  }

  let sd = getShiftDuration(shiftObj.startTime,shiftObj.endTime);
  let idle = getIdleTime(shiftObj.startTime,shiftObj.endTime);
  let active = getActiveTime(sd,idle);
  let quota = metQuota(shiftObj.date,active);

  let line = `${shiftObj.driverID},${shiftObj.driverName},${shiftObj.date},${shiftObj.startTime},${shiftObj.endTime},${sd},${idle},${active},${quota},false`;
  fs.appendFileSync(textFile,"\n"+line);

  return {...shiftObj,shiftDuration:sd,idleTime:idle,activeTime:active,metQuota:quota,hasBonus:false};
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
  let data = fs.readFileSync(textFile,"utf8").trim().split("\n");

  for (let i=1;i<data.length;i++){
    let p = data[i].split(",");
    if (p[0]===driverID && p[2]===date){
      p[9] = String(newValue);
      data[i] = p.join(",");
    }
  }

  fs.writeFileSync(textFile,data.join("\n"));
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
  let data = fs.readFileSync(textFile,"utf8").trim().split("\n");
  let count = 0, found = false;

  for (let i=1;i<data.length;i++){
    let p = data[i].split(",");
    if (p[0]===driverID){
      found = true;
      if (Number(p[2].split("-")[1])===Number(month) && p[9]==="true") count++;
    }
  }

  return found ? count : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
  let data = fs.readFileSync(textFile,"utf8").trim().split("\n");
  let total = 0;

  for (let i=1;i<data.length;i++){
    let p = data[i].split(",");
    if (p[0]===driverID && Number(p[2].split("-")[1])===Number(month))
      total += timeToSeconds(p[7]);
  }

  return secondsToTime(total);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
  let data = fs.readFileSync(textFile,"utf8").trim().split("\n");
  let days = 0;

  for (let i=1;i<data.length;i++){
    let p = data[i].split(",");
    if (p[0]===driverID && Number(p[2].split("-")[1])===Number(month)) days++;
  }

  let quota = (8*3600 + 24*60);
  let required = days * quota - bonusCount * quota;

  return secondsToTime(required > 0 ? required : 0);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {

  let data = fs.readFileSync(rateFile, "utf8").trim().split("\n");
  let rate = 0;

  for (let i = 1; i < data.length; i++) {
    if (data[i].split(",")[0] === driverID) {
      rate = Number(data[i].split(",")[1]);
    }
  }

  let actual = timeToSeconds(actualHours);
  let required = timeToSeconds(requiredHours);

  let missing = required - actual;
  if (missing < 0) missing = 0;

  let allowance = 1;
  if (missing > 5 * 3600) allowance = 0.75;
  if (missing > 10 * 3600) allowance = 0.5;
  if (missing > 15 * 3600) allowance = 0;

  let pay = (actual / 3600) * rate * allowance;

  return Math.floor(pay);
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
