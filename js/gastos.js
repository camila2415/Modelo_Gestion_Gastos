document.addEventListener('DOMContentLoaded', async () => {

    let db = null;
    let chartDona = null;
    let chartBarras = null;
    let idGastoEnEdicion = null;

    const IMGBB_API_KEY = 'c38a2e0a2948b8c2d2572b123652a281';

    let usuarioActivo = localStorage.getItem('sgg_usuario_activo') || 'chopper@gmail.com';
    localStorage.setItem('sgg_usuario_activo', usuarioActivo);

    const userEmailDisplay = document.getElementById('userEmailDisplay');
    if (userEmailDisplay) userEmailDisplay.textContent = usuarioActivo;

    const nombreArchivoDB = `sgg_database_${usuarioActivo.replace(/[^a-zA-Z0-9]/g, '_')}.sqlite`;

    const mostrarAlertaCustom = (mensaje, tituloOverride = null) => {
        const modal = document.getElementById('modalAlertaCustom');
        const txtTitulo = document.getElementById('modalAlertaTitulo');
        const txtMensaje = document.getElementById('modalAlertaMensaje');
        const btnAceptar = document.getElementById('btnAceptarAlertaCustom');

        const selectTema = document.getElementById('selectorTema') || document.querySelector('select');
        const valTema = selectTema ? selectTema.value.toLowerCase() : '';
        const esOnePiece = valTema.includes('piece') || document.body.getAttribute('data-tema') === 'one-piece';

        const tituloDefecto = esOnePiece ? '⚠️ Aviso del Navegante' : '⚠️ Atención del Sistema';

        if (modal && txtMensaje) {
            if (txtTitulo) txtTitulo.textContent = tituloOverride || tituloDefecto;
            txtMensaje.textContent = mensaje;
            modal.style.display = 'flex';

            if (btnAceptar) {
                btnAceptar.onclick = () => { modal.style.display = 'none'; };
            }
        } else {
            alert(`${tituloOverride || tituloDefecto}\n\n${mensaje}`);
        }
    };

    const cargarDesdeOPFS = async () => {
        try {
            const root = await navigator.storage.getDirectory();
            const fileHandle = await root.getFileHandle(nombreArchivoDB);
            const file = await fileHandle.getFile();
            const arrayBuffer = await file.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        } catch (err) {
            return null;
        }
    };

    const guardarEnOPFS = async () => {
        if (!db) return;
        try {
            const data = db.export();
            const root = await navigator.storage.getDirectory();
            const fileHandle = await root.getFileHandle(nombreArchivoDB, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(data);
            await writable.close();
        } catch (err) {
            console.error("❌ Error guardando en OPFS:", err);
        }
    };

    const initSQLiteDB = async () => {
        try {
            const SQL = await initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });

            const datosBinarios = await cargarDesdeOPFS();
            db = datosBinarios ? new SQL.Database(datosBinarios) : new SQL.Database();

            const DDL = `
                CREATE TABLE IF NOT EXISTS movimientos (
                    id INTEGER PRIMARY KEY,
                    email_usuario TEXT,
                    usuario TEXT,
                    tipo_movimiento TEXT NOT NULL,
                    monto REAL NOT NULL,
                    categoria TEXT NOT NULL,
                    fecha TEXT NOT NULL,
                    descripcion TEXT NOT NULL,
                    url_comprobante TEXT,
                    estado_activo INTEGER DEFAULT 1,
                    activo INTEGER DEFAULT 1
                );
            `;
            db.exec(DDL);

            try { db.exec("ALTER TABLE movimientos ADD COLUMN email_usuario TEXT;"); } catch (e) {}
            try { db.exec("ALTER TABLE movimientos ADD COLUMN estado_activo INTEGER DEFAULT 1;"); } catch (e) {}

            await guardarEnOPFS();
        } catch (err) {
            console.error("❌ Error inicializando SQLite:", err);
        }
    };

    const obtenerMovimientosSQL = () => {
        if (!db) return [];
        try {
            const query = `
                SELECT id, 
                       COALESCE(email_usuario, usuario) as email_usuario, 
                       tipo_movimiento, monto, categoria, fecha, descripcion, url_comprobante, 
                       COALESCE(estado_activo, activo) as estado_activo 
                FROM movimientos 
                WHERE (email_usuario = '${usuarioActivo}' OR usuario = '${usuarioActivo}') 
                  AND (estado_activo = 1 OR estado_activo = 'true' OR activo = 1 OR activo = 'true') 
                ORDER BY fecha DESC, id DESC;
            `;
            const res = db.exec(query);
            if (!res || res.length === 0) return [];

            const cols = res[0].columns;
            return res[0].values.map(row => {
                let obj = {};
                cols.forEach((col, idx) => {
                    if (col === 'estado_activo') {
                        obj[col] = true;
                    } else if (col === 'monto' || col === 'id') {
                        obj[col] = Number(row[idx]);
                    } else {
                        obj[col] = row[idx];
                    }
                });
                return obj;
            });
        } catch (err) {
            console.error("❌ Error en SELECT:", err);
            return [];
        }
    };

    const insertarMovimientoSQL = async (mov) => {
        if (!db) return;
        try {
            const stmt = db.prepare(`
                INSERT INTO movimientos (id, email_usuario, usuario, tipo_movimiento, monto, categoria, fecha, descripcion, url_comprobante, estado_activo, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1);
            `);
            stmt.run([
                mov.id,
                mov.email_usuario,
                mov.email_usuario,
                mov.tipo_movimiento,
                mov.monto,
                mov.categoria,
                mov.fecha,
                mov.descripcion,
                mov.url_comprobante
            ]);
            stmt.free();
            await guardarEnOPFS();
        } catch (err) {
            console.error("❌ Error en INSERT:", err);
        }
    };

    const actualizarMovimientoSQL = async (mov) => {
        if (!db) return;
        try {
            const stmt = db.prepare(`
                UPDATE movimientos 
                SET tipo_movimiento = ?, monto = ?, categoria = ?, fecha = ?, descripcion = ?, url_comprobante = COALESCE(?, url_comprobante)
                WHERE id = ? AND (email_usuario = ? OR usuario = ?);
            `);
            stmt.run([
                mov.tipo_movimiento,
                mov.monto,
                mov.categoria,
                mov.fecha,
                mov.descripcion,
                mov.url_comprobante,
                mov.id,
                usuarioActivo,
                usuarioActivo
            ]);
            stmt.free();
            await guardarEnOPFS();
        } catch (err) {
            console.error("❌ Error en UPDATE:", err);
        }
    };

    const deshabilitarMovimientoSQL = async (id) => {
        if (!db) return;
        db.exec(`UPDATE movimientos SET estado_activo = 0, activo = 0 WHERE id = ${id};`);
        await guardarEnOPFS();
    };

    const subirComprobanteAPI = async (fileInput) => {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) return null;
        try {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            return (data && data.data) ? data.data.url : null;
        } catch (err) {
            return null;
        }
    };

    const actualizarDashboard = () => {
        const movimientos = obtenerMovimientosSQL();
        console.log("📊 Movimientos cargados desde SQLite:", movimientos);

        let balance = 0;
        let totalIngresos = 0;
        let totalEgresos = 0;
        let egresosPorCat = {};

        const tablaBody = document.getElementById('tablaGastosBody') || document.querySelector('tbody');
        if (tablaBody) tablaBody.innerHTML = '';

        if (movimientos.length === 0 && tablaBody) {
            tablaBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:15px; opacity:0.6;">No hay movimientos registrados.</td></tr>`;
        }

        movimientos.forEach(m => {
            const monto = Number(m.monto) || 0;
            const esIngreso = m.tipo_movimiento.toLowerCase().includes('ingreso');

            if (esIngreso) {
                balance += monto;
                totalIngresos += monto;
            } else {
                balance -= monto;
                totalEgresos += monto;
                const cat = m.categoria || 'Varios';
                egresosPorCat[cat] = (egresosPorCat[cat] || 0) + monto;
            }

            if (tablaBody) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${m.fecha || '-'}</td>
                    <td><b style="color:${esIngreso ? '#10b981' : '#ef4444'}">${esIngreso ? '🟢 Ingreso' : '🔴 Egreso'}</b></td>
                    <td>${m.categoria || 'General'}</td>
                    <td>${m.descripcion || ''}</td>
                    <td style="font-weight:bold; color:${esIngreso ? '#10b981' : '#ef4444'}">${esIngreso ? '+' : '-'}$${monto.toFixed(2)}</td>
                    <td>${m.url_comprobante ? `<a href="${m.url_comprobante}" target="_blank" style="color:#3b82f6;">📎 Ticket</a>` : 'Sin ticket'}</td>
                    <td>
                        <button class="btn-editar" data-id="${m.id}" style="cursor:pointer; padding:2px 6px; margin-right:4px;">✏️</button>
                        <button class="btn-eliminar" data-id="${m.id}" style="cursor:pointer; padding:2px 6px;">🗑️</button>
                    </td>
                `;
                tablaBody.appendChild(tr);
            }
        });

        const balanceEl = document.getElementById('totalGastado');
        if (balanceEl) {
            balanceEl.textContent = `${balance.toFixed(2)}`;
            balanceEl.style.color = balance >= 0 ? '#10b981' : '#ef4444';
        }

        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const id = Number(e.currentTarget.getAttribute('data-id'));
                const gasto = movimientos.find(item => item.id === id);

                if (gasto) {
                    const formGasto = document.getElementById('formGasto') || document.querySelector('form');
                    const tipoEl = formGasto.querySelector('select');
                    const montoEl = formGasto.querySelector('input[type="number"]');
                    const catEl = document.getElementById('categoria') || formGasto.querySelectorAll('input[type="text"]')[0];
                    const fechaEl = formGasto.querySelector('input[type="date"]');
                    const descEl = document.getElementById('descripcion') || formGasto.querySelectorAll('input[type="text"]')[1];
                    const btnSubmit = formGasto.querySelector('button');

                    if (tipoEl) tipoEl.value = gasto.tipo_movimiento;
                    if (montoEl) montoEl.value = gasto.monto;
                    if (catEl) catEl.value = gasto.categoria;
                    if (fechaEl) fechaEl.value = gasto.fecha;
                    if (descEl) descEl.value = gasto.descripcion;

                    idGastoEnEdicion = id;
                    if (btnSubmit) btnSubmit.textContent = "💾 Guardar Cambios";

                    mostrarAlertaCustom("Modificá los campos en el formulario y presioná 'Guardar Cambios'.", "✏️ Modo Edición");
                }
            };
        });

        document.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                const id = Number(e.currentTarget.getAttribute('data-id'));
                await deshabilitarMovimientoSQL(id);
                actualizarDashboard();
            };
        });

        renderizarGraficos(egresosPorCat, totalIngresos, totalEgresos);
    };

    const renderizarGraficos = (egresosPorCat, ingresos, egresos) => {
        if (typeof Chart === 'undefined') return;

        const modo = document.body.getAttribute('data-modo') || 'light';
        const colorTexto = modo === 'dark' ? '#ffffff' : '#0f172a';

        const canvasDona = document.getElementById('chartDona') || document.querySelectorAll('canvas')[0];
        if (canvasDona) {
            if (chartDona) chartDona.destroy();
            const cats = Object.keys(egresosPorCat);
            const vals = Object.values(egresosPorCat);

            chartDona = new Chart(canvasDona, {
                type: 'doughnut',
                data: {
                    labels: cats.length ? cats : ['Sin egresos'],
                    datasets: [{
                        data: vals.length ? vals : [1],
                        backgroundColor: ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: colorTexto } } } }
            });
        }

        const canvasBarras = document.getElementById('chartBarras') || document.querySelectorAll('canvas')[1];
        if (canvasBarras) {
            if (chartBarras) chartBarras.destroy();
            chartBarras = new Chart(canvasBarras, {
                type: 'bar',
                data: {
                    labels: ['Ingresos', 'Egresos'],
                    datasets: [{ label: 'Monto ($)', data: [ingresos, egresos], backgroundColor: ['#10b981', '#ef4444'] }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: colorTexto } } },
                    scales: { x: { ticks: { color: colorTexto } }, y: { ticks: { color: colorTexto } } }
                }
            });
        }
    };

    const procesarGuardadoGasto = async (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const formGasto = document.getElementById('formGasto') || document.querySelector('form');
        if (!formGasto) return;

        const tipoEl = formGasto.querySelector('select');
        const montoEl = formGasto.querySelector('input[type="number"]');
        const catEl = document.getElementById('categoria') || formGasto.querySelectorAll('input[type="text"]')[0];
        const fechaEl = formGasto.querySelector('input[type="date"]');
        const descEl = document.getElementById('descripcion') || formGasto.querySelectorAll('input[type="text"]')[1];
        const fileEl = formGasto.querySelector('input[type="file"]');
        const btnSubmit = formGasto.querySelector('button');

        const valMonto = montoEl ? parseFloat(montoEl.value) : 0;
        const valFecha = fechaEl ? fechaEl.value.trim() : '';
        const valCat = catEl ? catEl.value.trim() : '';
        const valDesc = descEl ? descEl.value.trim() : '';

        if (isNaN(valMonto) || valMonto <= 0) {
            mostrarAlertaCustom("Por favor ingresá un monto mayor a 0.");
            return;
        }
        if (!valFecha) {
            mostrarAlertaCustom("Por favor seleccioná la fecha del movimiento.");
            return;
        }
        if (!valCat) {
            mostrarAlertaCustom("Por favor ingresá la categoría del movimiento.");
            return;
        }
        if (!valDesc) {
            mostrarAlertaCustom("Por favor ingresá una descripción.");
            return;
        }

        let urlTicket = await subirComprobanteAPI(fileEl);

        if (idGastoEnEdicion) {
            const movEditado = {
                id: idGastoEnEdicion,
                tipo_movimiento: tipoEl ? tipoEl.value.toLowerCase() : 'egreso',
                monto: Number(valMonto),
                categoria: valCat,
                fecha: valFecha,
                descripcion: valDesc,
                url_comprobante: urlTicket
            };
            await actualizarMovimientoSQL(movEditado);
            idGastoEnEdicion = null;
            if (btnSubmit) btnSubmit.textContent = "Registrar Movimiento";
            mostrarAlertaCustom("¡Movimiento actualizado correctamente!", "💾 Guardado Exitoso");
        } else {
            const nuevoMov = {
                id: Date.now(),
                email_usuario: usuarioActivo,
                tipo_movimiento: tipoEl ? tipoEl.value.toLowerCase() : 'egreso',
                monto: Number(valMonto),
                categoria: valCat,
                fecha: valFecha,
                descripcion: valDesc,
                url_comprobante: urlTicket,
                estado_activo: true
            };
            await insertarMovimientoSQL(nuevoMov);
            mostrarAlertaCustom("¡Movimiento registrado correctamente!", "🎉 Registro Exitoso");
        }

        if (montoEl) montoEl.value = '';
        if (descEl) descEl.value = '';
        if (catEl) catEl.value = '';
        if (fileEl) fileEl.value = '';

        actualizarDashboard();
    };

    const formEl = document.getElementById('formGasto') || document.querySelector('form');
    if (formEl) {
        formEl.onsubmit = procesarGuardadoGasto;
        const btnGuardar = formEl.querySelector('button');
        if (btnGuardar) btnGuardar.onclick = procesarGuardadoGasto;
    }

    const btnAbandonar = document.getElementById('btnAbandonar') || document.getElementById('btnLogout') || document.querySelector('.btn-danger');
    const modalLogout = document.getElementById('modalLogoutCustom');
    const btnAceptarLogout = document.getElementById('btnAceptarLogoutCustom');
    const btnCancelarLogout = document.getElementById('btnCancelarLogoutCustom');

    if (btnAbandonar) {
        btnAbandonar.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const selectTema = document.getElementById('selectorTema') || document.querySelectorAll('select')[0];
            const textoTemaSelect = selectTema ? selectTema.options[selectTema.selectedIndex].text.toLowerCase() : '';
            const temaAttr = document.body.getAttribute('data-tema') || '';
            const esOnePiece = textoTemaSelect.includes('piece') || temaAttr === 'one-piece';

            if (modalLogout) {
                const tituloModal = modalLogout.querySelector('.modal-titulo');
                const mensajeModal = modalLogout.querySelector('.modal-mensaje');

                if (esOnePiece) {
                    if (tituloModal) tituloModal.textContent = "⚓ ¡Atención Capitán!";
                    if (mensajeModal) mensajeModal.textContent = "¿Estás seguro de que deseas abandonar el barco y cerrar sesión?";
                    if (btnAceptarLogout) btnAceptarLogout.textContent = "Sí, Abandonar";
                } else {
                    if (tituloModal) tituloModal.textContent = "🔐 Cerrar Sesión";
                    if (mensajeModal) mensajeModal.textContent = "¿Estás seguro de que deseas salir del sistema?";
                    if (btnAceptarLogout) btnAceptarLogout.textContent = "Sí, Salir";
                }

                modalLogout.style.display = 'flex';
            } else if (confirm("¿Deseas cerrar sesión?")) {
                localStorage.removeItem('sgg_usuario_activo');
                window.location.href = 'index.html';
            }
        };
    }

    if (btnAceptarLogout) {
        btnAceptarLogout.onclick = (e) => {
            e.preventDefault();
            localStorage.removeItem('sgg_usuario_activo');
            window.location.href = 'index.html';
        };
    }

    if (btnCancelarLogout) {
        btnCancelarLogout.onclick = (e) => {
            e.preventDefault();
            if (modalLogout) modalLogout.style.display = 'none';
        };
    }

    window.addEventListener('cambioTemaModo', actualizarDashboard);

    await initSQLiteDB();
    actualizarDashboard();
});