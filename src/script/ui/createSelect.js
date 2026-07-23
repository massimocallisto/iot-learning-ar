import { jsonStore } from "../config/ConfJson";

export async function createSelect(viewer) {
  // Costruisce select materiali dinamiche in base ai gruppi del JSON.
  const root = document.querySelector("#control .control-inner") || document.querySelector("#control");
  if (!root) return;

  const section = document.createElement('section');
  section.className = 'ctrl-section';
  section.innerHTML = `<div class="ctrl-title">Materiali</div>`;

  const groups = jsonStore.getAllGroupName();
  for(const group of groups){
    
    const wrap = document.createElement('div');
    wrap.className = 'mb-2';
    wrap.innerHTML = `
    <label class="form-label fw-semibold mb-1">
        ${group.groupName}
    </label>
    `;


    const select = document.createElement('select');
    select.className = 'form-select form-select-sm';

    select.innerHTML = group.material
      .map(v => `<option value="${v.name}">${v.name}</option>`)
      .join('');


    select.addEventListener('change', async (e) =>{
        // Applica materiale scelto a tutte le mesh del gruppo.
      
        const mat = jsonStore.getMaterialByName(e.target.value);
        const meshs =  jsonStore.getMeshsByNameGroup(group.groupName);
        viewer.setColorForMesh(meshs, mat);
        

    });

    wrap.appendChild(select);
    section.appendChild(wrap);

  }

  root.appendChild(section);
}
