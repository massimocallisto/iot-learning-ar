export function exportJson({ groupMesh, visible, information, finalInformation, infoPoints } = {}) {
  const json = buildConfigJson({ groupMesh, visible, information, finalInformation, infoPoints });
  downloadJSON(json, "config.json");
  return json;
}


export function buildConfigJson({ groupMesh, visible, information, finalInformation, infoPoints } = {}) {
  const json = {};
  const groups = [];
  const regole = [];

  if(information){
    const testoRaw = information.get("testo");
    const testo = normalize(testoRaw);
    
    
    regole.push({
      tipologia: information.get("tipologia") || "information",
      formato: information.get("formato") || "markdown",
      testo  
    });

  }

  if(finalInformation){
    const testoRaw = finalInformation.get("testo");
    const testo = normalize(testoRaw);

    regole.push({
      tipologia: finalInformation.get("tipologia") || "finalInformation",
      formato: finalInformation.get("formato") || "markdown",
      testo
    });
  }

  if(infoPoints && infoPoints.length > 0){
    regole.push({
      tipologia: "informationPoint",
      infoPoint: infoPoints.map((infoPoint) => ({
        name: infoPoint.name,
        parte: normalize(infoPoint.parte),
        formato: "markdown",
        descrizione: infoPoint.descrizione
      }))
    });
  }
  

  regole.push({
    tipologia: "ar"
  });

  json.regole = regole;

  return json;
}



function normalize(value) {
  if (value == null) return "";

  if (value instanceof Set) {
    const arr = Array.from(value);
    return arr.length <= 1 ? (arr[0] || "") : arr;
  }

  if (Array.isArray(value)) {
    return value.length <= 1 ? (value[0] || "") : value;
  }

  return value;
}

function downloadJSON(obj, fileName) {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();

  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
