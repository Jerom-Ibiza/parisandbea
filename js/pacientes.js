async function loadSession() {
    try {
        const r = await fetch('/api/session/info');
        const data = await r.json();
        if (!data.user) { location.href = '/pab-login.html'; return false; }
        document.getElementById('profName').textContent = data.user.nombre;
        return true;
    } catch (e) {
        console.error(e);
        location.href = '/pab-login.html';
        return false;
    }
}

async function fetchPatients(q) {
    if (!q) return [];
    const r = await fetch('/api/voice/suggest?q=' + encodeURIComponent(q));
    return await r.json();
}

async function getPatient(id) {
    const r = await fetch('/api/pacientes/' + id);
    return await r.json();
}

async function updatePatient(id, data) {
    await fetch('/api/pacientes/update/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

async function deletePatient(id) {
    await fetch('/api/pacientes/delete/' + id, { method: 'DELETE' });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!await loadSession()) return;

    const input = document.getElementById('searchInput');
    const tbody = document.querySelector('#patientsTable tbody');
    let timer;

    input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        timer = setTimeout(async () => {
            const list = await fetchPatients(q);
            tbody.innerHTML = list.map(p => `
        <tr data-id="${p.id_paciente}">
          <td>${p.nombre}</td>
          <td>${p.apellidos}</td>
          <td>${p.dni ?? ''}</td>
          <td><span class="material-icons edit">edit</span></td>
          <td><span class="material-icons delete">delete</span></td>
        </tr>`).join('');
        }, 300);
    });

    tbody.addEventListener('click', async e => {
        const tr = e.target.closest('tr');
        if (!tr) return;
        const id = tr.dataset.id;
        if (e.target.classList.contains('delete')) {
            const ok = await Swal.fire({
                icon: 'warning',
                title: '¿Eliminar definitivamente?',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });
            if (!ok.isConfirmed) return;
            await deletePatient(id);
            tr.remove();
            return;
        }
        if (e.target.classList.contains('edit')) {
            const p = await getPatient(id);
            const { value: data } = await Swal.fire({
                title: 'Editar paciente',
                html: `
          <input id="swNombre" class="swal2-input" placeholder="Nombre" value="${p.nombre || ''}">
          <input id="swApellidos" class="swal2-input" placeholder="Apellidos" value="${p.apellidos || ''}">
          <input id="swFecha" type="date" class="swal2-input" value="${p.fecha_nacimiento ? p.fecha_nacimiento.split('T')[0] : ''}">
          <input id="swGenero" class="swal2-input" placeholder="Género" value="${p.genero || ''}">
          <input id="swDni" class="swal2-input" placeholder="DNI" value="${p.dni || ''}">
          <input id="swDireccion" class="swal2-input" placeholder="Dirección" value="${p.direccion || ''}">
          <input id="swTelefono" class="swal2-input" placeholder="Teléfono" value="${p.telefono || ''}">
          <input id="swEmail" class="swal2-input" placeholder="Email" value="${p.email || ''}">
        `,
                focusConfirm: false,
                showCancelButton: true,
                preConfirm: () => ({
                    nombre: document.getElementById('swNombre').value.trim(),
                    apellidos: document.getElementById('swApellidos').value.trim(),
                    fecha_nacimiento: document.getElementById('swFecha').value,
                    genero: document.getElementById('swGenero').value.trim(),
                    dni: document.getElementById('swDni').value.trim(),
                    direccion: document.getElementById('swDireccion').value.trim(),
                    telefono: document.getElementById('swTelefono').value.trim(),
                    email: document.getElementById('swEmail').value.trim()
                })
            });
            if (!data) return;
            await updatePatient(id, data);
            tr.children[0].textContent = data.nombre;
            tr.children[1].textContent = data.apellidos;
            tr.children[2].textContent = data.dni;
        }
    });
});