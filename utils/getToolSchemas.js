/* utils/getToolSchemas.js � esquema detallado */

module.exports = (LOCAL_FUNCTIONS = {}) => {
  const tools = [
    { type: 'web_search' }                                       // 0 - b�squeda web
  ];

  /* helper sin argumentos */
  const noArgs = { type: 'object', properties: {} };

  /* ---------- CONTEXTO ---------- */
  if (LOCAL_FUNCTIONS.get_session_info)
    tools.push({
      type: 'function', name: 'get_session_info',
      description: 'Datos de sesi�n (pro + pac)', parameters: noArgs
    });

  if (LOCAL_FUNCTIONS.get_prof_preferences)
    tools.push({
      type: 'function', name: 'get_prof_preferences',
      description: 'Preferencias del profesional', parameters: noArgs
    });

  /* ---------- HISTORIAL ---------- */
  if (LOCAL_FUNCTIONS.add_historial)
    tools.push({
      type: 'function', name: 'add_historial',
      description: 'Crea historial si no existe',
      parameters: {
        type: 'object', required: ['motivo_consulta'],
        properties: {
          motivo_consulta: { type: 'string' },
          fecha_inicio_problema: { type: 'string', format: 'date' },
          antecedentes_personales: { type: 'string' },
          antecedentes_familiares: { type: 'string' },
          tratamientos_previos: { type: 'string' },
          medicacion_actual: { type: 'string' },
          alergias: { type: 'string' },
          habitos_vida: { type: 'string' },
          profesion: { type: 'string' }
        },
        additionalProperties: false
      }
    });

  if (LOCAL_FUNCTIONS.update_historial)
    tools.push({
      type: 'function', name: 'update_historial',
      description: 'Modifica un campo del historial',
      parameters: {
        type: 'object', required: ['campo', 'valor'],
        properties: {
          campo: {
            type: 'string', enum: [
              'motivo_consulta', 'fecha_inicio_problema',
              'antecedentes_personales', 'antecedentes_familiares',
              'tratamientos_previos', 'medicacion_actual',
              'alergias', 'habitos_vida', 'profesion'
            ]
          },
          valor: { type: 'string' }
        }
      }
    });

  /* ---------- EVALUACI�N ---------- */
  if (LOCAL_FUNCTIONS.add_evaluacion)
    tools.push({
      type: 'function', name: 'add_evaluacion',
      description: 'Registra una evaluaci�n completa',
      parameters: {
        type: 'object',
        required: ['fecha_evaluacion', 'diagnostico'],
        properties: {
          fecha_evaluacion: { type: 'string', format: 'date' },
          dolor_localizacion: { type: 'string' },
          dolor_intensidad: { type: 'string', enum: ['Leve', 'Moderado', 'Severo'] },
          dolor_tipo: { type: 'string' },
          dolor_irradia: { type: 'boolean' },
          dolor_descripcion: { type: 'string' },
          inspeccion_visual: { type: 'string' },
          palpacion: { type: 'string' },
          movilidad_articular: { type: 'string' },
          pruebas_funcionales: { type: 'string' },
          valoracion_neurologica: { type: 'string' },
          valoracion_postural: { type: 'string' },
          evaluacion_funcional: { type: 'string' },
          diagnostico: { type: 'string' },
          objetivos_terapeuticos: { type: 'string' }
        },
        additionalProperties: false
      }
    });

  if (LOCAL_FUNCTIONS.update_evaluacion)
    tools.push({
      type: 'function', name: 'update_evaluacion',
      description: 'Actualiza un campo de la �ltima evaluaci�n',
      parameters: {
        type: 'object', required: ['campo', 'valor'],
        properties: {
          campo: { type: 'string' },
          valor: { type: 'string' }
        }, additionalProperties: false
      }
    });

  if (LOCAL_FUNCTIONS.get_last_evaluaciones)
    tools.push({
      type: 'function', name: 'get_last_evaluaciones',
      description: '�ltimas N evaluaciones',
      parameters: {
        type: 'object',
        properties: { n: { type: 'integer', minimum: 1, maximum: 5, default: 1 } }
      }
    });

  /* ---------- TRATAMIENTO ---------- */
  if (LOCAL_FUNCTIONS.add_tratamiento)
    tools.push({
      type: 'function', name: 'add_tratamiento',
      description: 'Crea un tratamiento nuevo',
      parameters: {
        type: 'object',
        required: ['fecha_inicio', 'tecnicas_aplicadas', 'frecuencia_sesiones', 'duracion_sesion'],
        properties: {
          fecha_inicio: { type: 'string', format: 'date' },
          fecha_fin: { type: 'string', format: 'date' },
          tecnicas_aplicadas: { type: 'string' },
          frecuencia_sesiones: { type: 'string' },
          duracion_sesion: { type: 'string' },
          recomendaciones: { type: 'string' },
          estado: { type: 'string', enum: ['Activo', 'Finalizado', 'Suspendido'] },
          suplemento_prescrito: { type: 'string', description: 'Nombre comercial del suplemento (vacío si no hay)' },
          capsulas_por_bote: { type: 'integer' },
          dosis_diaria: { type: 'number' },
          fecha_inicio_suplementacion: { type: 'string', format: 'date' },
          dias_alerta: { type: 'integer' }
        },
        additionalProperties: false
      }
    });

  if (LOCAL_FUNCTIONS.update_tratamiento)
    tools.push({
      type: 'function', name: 'update_tratamiento',
      description: 'Modifica un campo del tratamiento activo',
      parameters: {
        type: 'object', required: ['campo', 'valor'],
        properties: {
          campo: { type: 'string' },
          valor: {
            oneOf: [
              { type: 'string' }, { type: 'number' }, { type: 'boolean' }
            ]
          }
        }, additionalProperties: false
      }
    });

  if (LOCAL_FUNCTIONS.get_last_tratamientos)
    tools.push({
      type: 'function', name: 'get_last_tratamientos',
      description: '�ltimos N tratamientos',
      parameters: {
        type: 'object',
        properties: { n: { type: 'integer', minimum: 1, maximum: 5, default: 1 } }
      }
    });

  /* ---------- SESI�N ---------- */
  if (LOCAL_FUNCTIONS.add_sesion)
    tools.push({
      type: 'function', name: 'add_sesion',
      description: 'A�ade una sesi�n al tratamiento activo',
      parameters: {
        type: 'object',
        required: ['fecha_sesion', 'hora_sesion', 'tecnicas_utilizadas'],
        properties: {
          fecha_sesion: { type: 'string', format: 'date' },
          hora_sesion: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          tecnicas_utilizadas: { type: 'string' },
          evolucion: { type: 'string' },
          modificaciones_tratamiento: { type: 'string' },
          observaciones: { type: 'string' }
        },
        additionalProperties: false
      }
    });

  if (LOCAL_FUNCTIONS.update_sesion)
    tools.push({
      type: 'function',
      name: 'update_sesion',
      description: 'Modifica un campo de la �ltima sesi�n registrada',
      parameters: {
        type: 'object',
        required: ['campo', 'valor'],
        additionalProperties: false,
        properties: {
          campo: {
            type: 'string',
            enum: [
              'fecha_sesion', 'hora_sesion', 'tecnicas_utilizadas', 'evolucion',
              'modificaciones_tratamiento', 'observaciones', 'id_bono'
            ]
          },
          /* string, n�mero o boolean seg�n el campo */
          valor: {
            oneOf: [
              { type: 'string' },
              { type: 'number' },
              { type: 'boolean' }
            ]
          }
        }
      }
    });


  if (LOCAL_FUNCTIONS.get_last_sesiones)
    tools.push({
      type: 'function', name: 'get_last_sesiones',
      description: '�ltimas N sesiones',
      parameters: {
        type: 'object',
        properties: { n: { type: 'integer', minimum: 1, maximum: 10, default: 1 } }
      }
    });

  /* ---------- CONSENTIMIENTO PDF ---------- */
  if (LOCAL_FUNCTIONS.create_consentimiento)
    tools.push({
      type: 'function',
      name: 'create_consentimiento',
      description: 'Genera el PDF de consentimiento informado de fisioterapia / osteopat�a y devuelve la URL',
      parameters: {
        type: 'object',
        properties: {
          nombre_representado: { type: 'string', description: 'Nombre del representado (opcional)' },
          calidad_representante: { type: 'string', description: 'Relaci�n o cargo (opcional)' },
          dni_representante: { type: 'string', description: 'DNI/NIE/Pasaporte (opcional)' },
          lang: { type: 'string', description: 'Idioma del documento: es | en | de | fr (por defecto es)' }
        },
        additionalProperties: false
      }
    });

  /* ---------- DOCUMENTO PDF GEN�RICO ---------- */
  if (LOCAL_FUNCTIONS.generate_document)
    tools.push({
      type: 'function',
      name: 'generate_document',
      description: 'Genera un PDF corporativo con t�tulo, contenido y opciones de estilo; devuelve la URL',
      parameters: {
        type: 'object',
        required: ['tituloDocumento', 'contenido'],
        properties: {
          tituloDocumento: { type: 'string', description: 'T�tulo que aparece en la cabecera' },
          contenido: {                                          /* string o array de p�rrafos */
            oneOf: [
              { type: 'string', description: 'Texto completo (puede usar \\n para p�rrafos)' },
              { type: 'array', items: { type: 'string' }, description: 'Lista de p�rrafos' }
            ]
          },
          /* par�metros opcionales */
          fechaDocumento: { type: 'string', description: 'dd/mm/aaaa (opcional)' },
          nombreArchivo: { type: 'string', description: 'Ej.: InformeJuan.pdf (opcional)' },
          colorTitulo: { type: 'string', description: 'por defecto #aed3c1' },
          colorTexto: { type: 'string', description: 'por defecto #000' },
          colorDatos: { type: 'string', description: 'por defecto #5b5b5b' },
          imagenes: {
            type: 'array',
            description: 'Rutas/URLs relativas de im�genes a insertar',
            items: { type: 'string' }
          }
        },
        additionalProperties: false
      }
    });

  /* ---------- CONSENTIMIENTO PUNCI�N SECA ---------- */
  if (LOCAL_FUNCTIONS.create_consentimiento_puncionseca)
    tools.push({
      type: 'function',
      name: 'create_consentimiento_puncionseca',
      description: 'Genera el PDF de consentimiento informado para punci�n seca y devuelve la URL',
      parameters: {
        type: 'object',
        properties: {
          revocar: { type: 'boolean', description: 'Si es true el documento refleja la revocaci�n del consentimiento' }
        },
        additionalProperties: false
      }
    });

  /* ---------- CONSENTIMIENTO SUELO P�LVICO ---------- */
  if (LOCAL_FUNCTIONS.create_consentimiento_suelopelvico)
    tools.push({
      type: 'function',
      name: 'create_consentimiento_suelopelvico',
      description: 'Genera el PDF de consentimiento informado de fisioterapia de suelo p�lvico y devuelve la URL',
      parameters: {
        type: 'object',
        properties: {
          nombreArchivo: { type: 'string', description: 'Nombre final del PDF (opcional)' },
          representanteLegal: {
            type: 'object',
            description: 'Datos del representante legal (opcional)',
            properties: {
              nombre: { type: 'string' },
              dni: { type: 'string' },
              parentesco: { type: 'string' }
            },
            additionalProperties: false
          }
        },
        additionalProperties: false
      }
    });

  /* ---------- CONSENTIMIENTO LOPD ---------- */
  if (LOCAL_FUNCTIONS.create_consentimiento_lopd)
    tools.push({
      type: 'function',
      name: 'create_consentimiento_lopd',
      description: 'Genera el PDF de consentimiento LOPD y devuelve la URL (y c�digo Viafirma)',
      parameters: {
        type: 'object',
        properties: {
          nombreArchivo: { type: 'string', description: 'Nombre final del PDF (opcional, incluye .pdf)' },
          fechaDocumento: { type: 'string', description: 'Fecha en formato yyyy-mm-dd (opcional)' },
          lang: {
            type: 'string',
            description: 'Idioma del documento: es | en | de | fr (por defecto es)'
          }
        },
        additionalProperties: false
      }
    });

  /* ---------- ENVIAR EMAIL ---------- */
  if (LOCAL_FUNCTIONS.send_mail)
    tools.push({
      type: 'function',
      name: 'send_mail',
      description: 'Env�a un email corporativo con plantilla HTML y adjuntos opcionales',
      parameters: {
        type: 'object',
        required: ['subject'],
        properties: {
          to: { type: 'string', description: 'Direcci�n de destino (opcional)' },
          id_paciente: { type: 'string', description: 'ID o c�digo PAC-XXXXX del paciente' },
          subject: { type: 'string' },
          text: { type: 'string', description: 'Texto plano (opcional)' },
          htmlContent: { type: 'string', description: 'HTML completo, si quieres sobrescribir la plantilla corporativa' },
          attachments: {
            type: 'array',
            description: 'Adjuntos opcionales',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                path: { type: 'string', description: 'URL absoluta o ruta local' }
              },
              required: ['filename', 'path'],
              additionalProperties: false
            }
          }
        },
        additionalProperties: false
      }
    });

  /* ---------- PROFESIONALES ---------- */
  if (LOCAL_FUNCTIONS.get_profesionales)
    tools.push({
      type: 'function',
      name: 'get_profesionales',
      description: 'Devuelve la lista completa de profesionales (m�x. 5)',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    });

  /* ---------- PRODUCTOS ---------- */
  if (LOCAL_FUNCTIONS.get_active_products)
    tools.push({
      type: 'function',
      name: 'get_active_products',
      description: 'Lista id, nombre, marca, proposito, imagen (URL completa) y pvp de los productos activos',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    });

  if (LOCAL_FUNCTIONS.get_product_by_id)
    tools.push({
      type: 'function',
      name: 'get_product_by_id',
      description: 'Informaci\xC3\xB3n completa de un producto por id_producto (imagen con URL completa)',
      parameters: { type: 'object', required: ['id_producto'], properties: { id_producto: { type: 'integer' } }, additionalProperties: false }
    });

  /* ---------- FECHA / HORA ---------- */
  if (LOCAL_FUNCTIONS.get_datetime)
    tools.push({
      type: 'function',
      name: 'get_datetime',
      description: 'Obtiene la fecha y hora actuales (ISO 8601)',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    });

  /* ---------- CHATS ---------- */
  if (LOCAL_FUNCTIONS.get_last_chats)
    tools.push({
      type: 'function',
      name: 'get_last_chats',
      description: 'Recupera la �ltima o las N (m�x. 3) �ltimas conversaciones guardadas',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 3, default: 1 }
        },
        additionalProperties: false
      }
    });
  /* ---------- CITAS ---------- */
  if (LOCAL_FUNCTIONS.add_cita)
    tools.push({
      type: 'function',
      name: 'add_cita',
      description: 'Crea una cita nueva',
      parameters: {
        type: 'object',
        required: ['titulo', 'fecha_hora_inicio', 'fecha_hora_fin'],
        properties: {
          titulo: { type: 'string' },
          descripcion: { type: 'string' },
          fecha_hora_inicio: { type: 'string', format: 'date-time' },
          fecha_hora_fin: { type: 'string', format: 'date-time' },
          persona: { type: 'string' },
          id_paciente: { type: 'integer' },
          estado: { type: 'string', enum: ['pendiente', 'confirmada', 'cancelada'] },
          ubicacion: { type: 'string' },
          notificacion: { type: 'string' },
          id_profesional: { type: 'integer' },
          id_servicio: { type: 'integer' }
        },
        additionalProperties: false
      }
    });

  if (LOCAL_FUNCTIONS.search_citas)
    tools.push({
      type: 'function',
      name: 'search_citas',
      description: 'Busca citas por profesional, paciente o rango de fechas',
      parameters: {
        type: 'object',
        properties: {
          id_profesional: { type: 'integer' },
          id_paciente: { type: 'integer' },
          id_servicio: { type: 'integer' },
          estado: { type: 'string', enum: ['pendiente', 'confirmada', 'cancelada'] },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          all: { type: 'boolean' }
        },
        additionalProperties: false
      }
    });

  /* ---------- BORRADOR PDF CHUNKED ---------- */
  if (LOCAL_FUNCTIONS.start_document)
    tools.push({
      type: 'function', name: 'start_document',
      description: 'Inicia un borrador de PDF y devuelve draftId',
      parameters: {
        type: 'object', required: ['tituloDocumento'],
        properties: {
          tituloDocumento: { type: 'string' },
          opciones: { type: 'object', description: 'Opciones mismas que generate_document' }
        }
      }
    });

  if (LOCAL_FUNCTIONS.append_chunk)
    tools.push({
      type: 'function', name: 'append_chunk',
      description: 'A�ade texto (chunk) al borrador indicado por draftId',
      parameters: {
        type: 'object', required: ['draftId', 'texto'],
        properties: {
          draftId: { type: 'integer' },
          texto: { type: 'string', description: 'M�x. 15 000 caracteres' }
        }
      }
    });

  if (LOCAL_FUNCTIONS.finalize_document)
    tools.push({
      type: 'function', name: 'finalize_document',
      description: 'Genera el PDF con todos los chunks y devuelve la URL',
      parameters: {
        type: 'object', required: ['draftId'],
        properties: { draftId: { type: 'integer' } }
      }
    });

  /* ---------- LISTAR ARCHIVOS DE CARPETA ---------- */
  if (LOCAL_FUNCTIONS.list_files)
    tools.push({
      type: 'function',
      name: 'list_files',
      description: 'Devuelve la lista de archivos dentro de una carpeta del servidor (images, documentos, etc.)',
      parameters: {
        type: 'object',
        required: ['folder'],
        properties: {
          folder: {
            type: 'string',
            description: `Carpeta permitida. Ejemplos:
  - images
  - images/recursos
  - images/servicios
  - images/muscles
  - documentos
  - documentos/consentimientos`
          }
        }
      }
    });

  /* ---------- LISTAR /tmp ---------- */
  if (LOCAL_FUNCTIONS.list_tmp_files)
    tools.push({
      type: 'function',
      name: 'list_tmp_files',
      description: 'Devuelve la lista de archivos que hay en /tmp con su tmpName y origName',
      parameters: { type: 'object', properties: {} }
    });

  /* ---------- LISTAR adjuntos paciente ---------- */
  if (LOCAL_FUNCTIONS.list_patient_files)
    tools.push({
      type: 'function',
      name: 'list_patient_files',
      description: 'Lista los �ltimos N archivos guardados del paciente',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 } }
      }
    });

  if (LOCAL_FUNCTIONS.get_patient_file)
    tools.push({
      type: 'function',
      name: 'get_patient_file',
      description: 'Devuelve ruta y nombre de un adjunto dado su id_file',
      parameters: {
        type: 'object',
        required: ['id_file'],
        properties: { id_file: { type: 'integer' } }
      }
    });

  return tools;
};