let recLimit = 9999;
let totSku = 519304;
let loopCount = 1;
if (totSku >= recLimit) {
  loopCount = Math.ceil(totSku / recLimit);
}
let stopCounter = 0;
let i = 0;
while (i < loopCount) {
  console.log("Your process");
  stopCounter++;
  if (stopCounter > 3) {
    setTimeout(() => {
      console.log("stopCounter : " + stopCounter);
    }, 1000).then(() => {
      stopCounter = 0;
    });
  }
}
