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
    const r = await fetch('/api/pacientes/update/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return r.ok;
}

async function deletePatient(id) {
    const r = await fetch('/api/pacientes/delete/' + id, { method: 'DELETE' });
    return r.ok;
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
                title: '¿Eliminar paciente? ¿Seguro? <br><br> ¡Solo si lo solicita el paciente o su tutor legal! <br><br> ¡POR ESCRITO Y FIRMADO!',
                html: 'Esta operación no puede deshacerse!! Se eliminará el paciente con todos sus datos personales y sanitarios!',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });
            if (!ok.isConfirmed) return;
            const okDel = await deletePatient(id);
            if (okDel) {
                tr.remove();
                await Swal.fire({
                    icon: 'success',
                    title: 'Paciente eliminado'
                });
            }
            return;
        }
        if (e.target.classList.contains('edit')) {
            const p = await getPatient(id);
            const { value: data } = await Swal.fire({
                title: '<span class="modal-title-icon material-icons">edit</span>Editar paciente',
                html: `
          <div class="modal-fields-2col">
            <div class="modal-field"><span class="material-symbols-outlined">person</span><input id="swNombre" class="swal2-input" placeholder="Nombre" value="${p.nombre || ''}"></div>
            <div class="modal-field"><span class="material-symbols-outlined">family_restroom</span><input id="swApellidos" class="swal2-input" placeholder="Apellidos" value="${p.apellidos || ''}"></div>
            <div class="modal-field"><span class="material-symbols-outlined">early_on</span><input id="swFecha" type="date" class="swal2-input" value="${p.fecha_nacimiento ? p.fecha_nacimiento.split('T')[0] : ''}"></div>
            <div class="modal-field"><span class="material-symbols-outlined">transgender</span><input id="swGenero" class="swal2-input" placeholder="Género" value="${p.genero || ''}"></div>
            <div class="modal-field"><span class="material-symbols-outlined">id_card</span><input id="swDni" class="swal2-input" placeholder="DNI" value="${p.dni || ''}"></div>
            <div class="modal-field"><span class="material-symbols-outlined">home_pin</span><input id="swDireccion" class="swal2-input" placeholder="Dirección" value="${p.direccion || ''}"></div>
            <div class="modal-field"><span class="material-symbols-outlined">mobile_hand</span><input id="swTelefono" class="swal2-input" placeholder="Teléfono" value="${p.telefono || ''}"></div>
            <div class="modal-field"><span class="material-symbols-outlined">mail</span><input id="swEmail" class="swal2-input" placeholder="Email" value="${p.email || ''}"></div>
          </div>
        `,
                customClass: { popup: 'edit-patient-popup' },
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
            const okUpd = await updatePatient(id, data);
            if (okUpd) {
                tr.children[0].textContent = data.nombre;
                tr.children[1].textContent = data.apellidos;
                tr.children[2].textContent = data.dni;
                await Swal.fire({
                    icon: 'success',
                    title: 'Datos guardados'
                });
            }
        }
    });
});