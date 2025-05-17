/* utils/getToolSchemas.js — esquema detallado */

module.exports = (LOCAL_FUNCTIONS = {}) => {
  const tools = [
    { type: 'web_search' }                                       // 0 - búsqueda web
  ];

  /* helper sin argumentos */
  const noArgs = { type:'object', properties:{} };

  /* ---------- CONTEXTO ---------- */
  if (LOCAL_FUNCTIONS.get_session_info)
    tools.push({
      type:'function', name:'get_session_info',
      description:'Datos de sesión (pro + pac)', parameters:noArgs });

  if (LOCAL_FUNCTIONS.get_prof_preferences)
    tools.push({
      type:'function', name:'get_prof_preferences',
      description:'Preferencias del profesional', parameters:noArgs });

  /* ---------- HISTORIAL ---------- */
  if (LOCAL_FUNCTIONS.add_historial)
    tools.push({
      type:'function', name:'add_historial',
      description:'Crea historial si no existe',
      parameters:{
        type:'object', required:['motivo_consulta'],
        properties:{
          motivo_consulta       :{type:'string'},
          fecha_inicio_problema :{type:'string',format:'date'},
          antecedentes_personales:{type:'string'},
          antecedentes_familiares:{type:'string'},
          tratamientos_previos  :{type:'string'},
          medicacion_actual     :{type:'string'},
          alergias              :{type:'string'},
          habitos_vida          :{type:'string'},
          profesion             :{type:'string'}
        },
        additionalProperties:false
      }
    });

  if (LOCAL_FUNCTIONS.update_historial)
    tools.push({
      type:'function', name:'update_historial',
      description:'Modifica un campo del historial',
      parameters:{
        type:'object', required:['campo','valor'],
        properties:{
          campo:{type:'string', enum:[
            'motivo_consulta','fecha_inicio_problema',
            'antecedentes_personales','antecedentes_familiares',
            'tratamientos_previos','medicacion_actual',
            'alergias','habitos_vida','profesion'
          ]},
          valor:{type:'string'}
        }
      }
    });

  /* ---------- EVALUACIÓN ---------- */
  if (LOCAL_FUNCTIONS.add_evaluacion)
    tools.push({
      type:'function', name:'add_evaluacion',
      description:'Registra una evaluación completa',
      parameters:{
        type:'object',
        required:['fecha_evaluacion','diagnostico'],
        properties:{
          fecha_evaluacion      :{type:'string',format:'date'},
          dolor_localizacion    :{type:'string'},
          dolor_intensidad      :{type:'string',enum:['Leve','Moderado','Severo']},
          dolor_tipo            :{type:'string'},
          dolor_irradia         :{type:'boolean'},
          dolor_descripcion     :{type:'string'},
          inspeccion_visual     :{type:'string'},
          palpacion             :{type:'string'},
          movilidad_articular   :{type:'string'},
          pruebas_funcionales   :{type:'string'},
          valoracion_neurologica:{type:'string'},
          valoracion_postural   :{type:'string'},
          evaluacion_funcional  :{type:'string'},
          diagnostico           :{type:'string'},
          objetivos_terapeuticos:{type:'string'}
        },
        additionalProperties:false
      }
    });

  if (LOCAL_FUNCTIONS.update_evaluacion)
    tools.push({
      type:'function', name:'update_evaluacion',
      description:'Actualiza un campo de la última evaluación',
      parameters:{
        type:'object', required:['campo','valor'],
        properties:{
          campo:{type:'string'},
          valor:{type:'string'}
        }, additionalProperties:false
      }
    });

  if (LOCAL_FUNCTIONS.get_last_evaluaciones)
    tools.push({
      type:'function', name:'get_last_evaluaciones',
      description:'Últimas N evaluaciones',
      parameters:{
        type:'object',
        properties:{ n:{type:'integer',minimum:1,maximum:5,default:1} }
      }
    });

  /* ---------- TRATAMIENTO ---------- */
  if (LOCAL_FUNCTIONS.add_tratamiento)
    tools.push({
      type:'function', name:'add_tratamiento',
      description:'Crea un tratamiento nuevo',
      parameters:{
        type:'object',
        required:['fecha_inicio','tecnicas_aplicadas','frecuencia_sesiones','duracion_sesion'],
        properties:{
          fecha_inicio               :{type:'string',format:'date'},
          fecha_fin                  :{type:'string',format:'date'},
          tecnicas_aplicadas         :{type:'string'},
          frecuencia_sesiones        :{type:'string'},
          duracion_sesion            :{type:'string'},
          recomendaciones            :{type:'string'},
          estado                     :{type:'string',enum:['Activo','Finalizado','Suspendido']},
          suplemento_prescrito       :{type:'boolean'},
          capsulas_por_bote          :{type:'integer'},
          dosis_diaria               :{type:'number'},
          fecha_inicio_suplementacion:{type:'string',format:'date'},
          dias_alerta                :{type:'integer'}
        },
        additionalProperties:false
      }
    });

  if (LOCAL_FUNCTIONS.update_tratamiento)
    tools.push({
      type:'function', name:'update_tratamiento',
      description:'Modifica un campo del tratamiento activo',
      parameters:{
        type:'object', required:['campo','valor'],
        properties:{
          campo:{type:'string'},
          valor:{oneOf:[
            {type:'string'},{type:'number'},{type:'boolean'}
          ]}
        }, additionalProperties:false
      }
    });

  if (LOCAL_FUNCTIONS.get_last_tratamientos)
    tools.push({
      type:'function', name:'get_last_tratamientos',
      description:'Últimos N tratamientos',
      parameters:{
        type:'object',
        properties:{ n:{type:'integer',minimum:1,maximum:5,default:1} }
      }
    });

  /* ---------- SESIÓN ---------- */
  if (LOCAL_FUNCTIONS.add_sesion)
    tools.push({
      type:'function', name:'add_sesion',
      description:'Añade una sesión al tratamiento activo',
      parameters:{
        type:'object',
        required:['fecha_sesion','hora_sesion','tecnicas_utilizadas'],
        properties:{
          fecha_sesion              :{type:'string',format:'date'},
          hora_sesion               :{type:'string',pattern:'^\\d{2}:\\d{2}$'},
          tecnicas_utilizadas       :{type:'string'},
          evolucion                 :{type:'string'},
          modificaciones_tratamiento:{type:'string'},
          observaciones             :{type:'string'}
        },
        additionalProperties:false
      }
    });
	
	if (LOCAL_FUNCTIONS.update_sesion)
	  tools.push({
		type: 'function',
		name: 'update_sesion',
		description: 'Modifica un campo de la última sesión registrada',
		parameters: {
		  type: 'object',
		  required: ['campo', 'valor'],
		  additionalProperties: false,
		  properties: {
			campo: {
			  type: 'string',
			  enum: [
				'fecha_sesion','hora_sesion','tecnicas_utilizadas','evolucion',
				'modificaciones_tratamiento','observaciones','id_bono'
			  ]
			},
			/* string, número o boolean según el campo */
			valor: { oneOf:[
			  { type:'string' },
			  { type:'number' },
			  { type:'boolean' }
			] }
		  }
		}
	  });


  if (LOCAL_FUNCTIONS.get_last_sesiones)
    tools.push({
      type:'function', name:'get_last_sesiones',
      description:'Últimas N sesiones',
      parameters:{
        type:'object',
        properties:{ n:{type:'integer',minimum:1,maximum:10,default:1} }
      }
    });
	
  /* ---------- CONSENTIMIENTO PDF ---------- */
  if (LOCAL_FUNCTIONS.create_consentimiento)
    tools.push({
      type       : 'function',
      name       : 'create_consentimiento',
      description: 'Genera el PDF de consentimiento informado de fisioterapia / osteopatía y devuelve la URL',
      parameters : {
        type      : 'object',
        properties: {
          nombre_representado : { type:'string', description:'Nombre del representado (opcional)' },
          calidad_representante: { type:'string', description:'Relación o cargo (opcional)' },
          dni_representante   : { type:'string', description:'DNI/NIE/Pasaporte (opcional)' }
        },
        additionalProperties: false
      }
    });
	
  /* ---------- DOCUMENTO PDF GENÉRICO ---------- */
  if (LOCAL_FUNCTIONS.generate_document)
    tools.push({
      type       : 'function',
      name       : 'generate_document',
      description: 'Genera un PDF corporativo con título, contenido y opciones de estilo; devuelve la URL',
      parameters : {
        type      : 'object',
        required  : ['tituloDocumento','contenido'],
        properties: {
          tituloDocumento : { type:'string', description:'Título que aparece en la cabecera' },
          contenido       : {                                          /* string o array de párrafos */
            oneOf:[
              { type:'string', description:'Texto completo (puede usar \\n para párrafos)' },
              { type:'array',  items:{type:'string'}, description:'Lista de párrafos' }
            ]
          },
          /* parámetros opcionales */
          fechaDocumento  : { type:'string', description:'dd/mm/aaaa (opcional)' },
          nombreArchivo   : { type:'string', description:'Ej.: InformeJuan.pdf (opcional)' },
          colorTitulo     : { type:'string', description:'por defecto #aed3c1' },
          colorTexto      : { type:'string', description:'por defecto #000' },
          colorDatos      : { type:'string', description:'por defecto #5b5b5b' },
          imagenes        : {
            type :'array',
            description:'Rutas/URLs relativas de imágenes a insertar',
            items:{ type:'string' }
          }
        },
        additionalProperties:false
      }
    });
	
  /* ---------- CONSENTIMIENTO PUNCIÓN SECA ---------- */
  if (LOCAL_FUNCTIONS.create_consentimiento_puncionseca)
    tools.push({
      type       : 'function',
      name       : 'create_consentimiento_puncionseca',
      description: 'Genera el PDF de consentimiento informado para punción seca y devuelve la URL',
      parameters : {
        type      : 'object',
        properties: {
          revocar:{ type:'boolean', description:'Si es true el documento refleja la revocación del consentimiento' }
        },
        additionalProperties:false
      }
    });
	
  /* ---------- CONSENTIMIENTO SUELO PÉLVICO ---------- */
  if (LOCAL_FUNCTIONS.create_consentimiento_suelopelvico)
    tools.push({
      type       : 'function',
      name       : 'create_consentimiento_suelopelvico',
      description: 'Genera el PDF de consentimiento informado de fisioterapia de suelo pélvico y devuelve la URL',
      parameters : {
        type      : 'object',
        properties: {
          nombreArchivo: { type:'string', description:'Nombre final del PDF (opcional)' },
          representanteLegal: {
            type :'object',
            description:'Datos del representante legal (opcional)',
            properties:{
              nombre     : { type:'string' },
              dni        : { type:'string' },
              parentesco : { type:'string' }
            },
            additionalProperties:false
          }
        },
        additionalProperties:false
      }
    });
	
  /* ---------- CONSENTIMIENTO LOPD ---------- */
  if (LOCAL_FUNCTIONS.create_consentimiento_lopd)
    tools.push({
      type       : 'function',
      name       : 'create_consentimiento_lopd',
      description: 'Genera el PDF de consentimiento LOPD y devuelve la URL (y código Viafirma)',
      parameters : {
        type      : 'object',
        properties: {
          nombreArchivo  : { type:'string', description:'Nombre final del PDF (opcional, incluye .pdf)' },
          fechaDocumento : { type:'string', description:'Fecha en formato yyyy-mm-dd (opcional)' }
        },
        additionalProperties:false
      }
    });
	
  /* ---------- BUSCAR PACIENTES ---------- */
  if (LOCAL_FUNCTIONS.search_pacientes)
    tools.push({
      type       : 'function',
      name       : 'search_pacientes',
      description: 'Busca pacientes por nombre, apellidos, teléfono, DNI o rango de fecha de alta',
      parameters : {
        type      : 'object',
        properties: {
          nombre    : { type:'string' },
          apellidos : { type:'string' },
          telefono  : { type:'string' },
          dni       : { type:'string' },
          startDate : { type:'string', description:'yyyy-mm-dd' },
          endDate   : { type:'string', description:'yyyy-mm-dd' }
        },
        additionalProperties:false
      }
    });

  /* ---------- ACTUALIZAR PACIENTE ---------- */
  if (LOCAL_FUNCTIONS.update_paciente)
    tools.push({
      type       : 'function',
      name       : 'update_paciente',
      description: 'Actualiza datos personales de un paciente',
      parameters : {
        type      : 'object',
        required  : ['id_paciente'],
        properties: {
          id_paciente      : { type:'integer' },
          nombre           : { type:'string' },
          apellidos        : { type:'string' },
          fecha_nacimiento : { type:'string', description:'yyyy-mm-dd' },
          genero           : { type:'string', enum:['Masculino','Femenino','Otro'] },
          dni              : { type:'string' },
          direccion        : { type:'string' },
          telefono         : { type:'string' },
          email            : { type:'string' }
        },
        additionalProperties:false
      }
    });
	
  /* ---------- ENVIAR EMAIL ---------- */
  if (LOCAL_FUNCTIONS.send_mail)
    tools.push({
      type       : 'function',
      name       : 'send_mail',
      description: 'Envía un email corporativo con plantilla HTML y adjuntos opcionales',
      parameters : {
        type      : 'object',
        required  : ['to','subject'],
        properties: {
          to          : { type:'string', description:'Dirección del destinatario' },
          subject     : { type:'string' },
          text        : { type:'string', description:'Texto plano (opcional)' },
          htmlContent : { type:'string', description:'HTML completo, si quieres sobrescribir la plantilla corporativa' },
          attachments : {
            type :'array',
            description:'Adjuntos opcionales',
            items:{
              type:'object',
              properties:{
                filename:{ type:'string' },
                path    :{ type:'string', description:'URL absoluta o ruta local' }
              },
              required:['filename','path'],
              additionalProperties:false
            }
          }
        },
        additionalProperties:false
      }
    });

  /* ---------- PROFESIONALES ---------- */
  if (LOCAL_FUNCTIONS.get_profesionales)
    tools.push({
      type       : 'function',
      name       : 'get_profesionales',
      description: 'Devuelve la lista completa de profesionales (máx. 5)',
      parameters : { type:'object', properties:{}, additionalProperties:false }
    });
	
  /* ---------- FECHA / HORA ---------- */
  if (LOCAL_FUNCTIONS.get_datetime)
    tools.push({
      type       : 'function',
      name       : 'get_datetime',
      description: 'Obtiene la fecha y hora actuales (ISO 8601)',
      parameters : { type:'object', properties:{}, additionalProperties:false }
    });
	
	/* ---------- CHATS ---------- */
	if (LOCAL_FUNCTIONS.get_last_chats)
	  tools.push({
		type       : 'function',
		name       : 'get_last_chats',
		description: 'Recupera la última o las N (máx. 3) últimas conversaciones guardadas',
		parameters : {
		  type      : 'object',
		  properties: {
			limit: { type:'integer', minimum:1, maximum:3, default:1 }
		  },
		  additionalProperties:false
		}
	  });
	
  /* ---------- BORRADOR PDF CHUNKED ---------- */
  if (LOCAL_FUNCTIONS.start_document)
    tools.push({
      type:'function', name:'start_document',
      description:'Inicia un borrador de PDF y devuelve draftId',
      parameters:{
        type:'object', required:['tituloDocumento'],
        properties:{
          tituloDocumento:{type:'string'},
          opciones:{type:'object',description:'Opciones mismas que generate_document'}
        }
      }
    });

  if (LOCAL_FUNCTIONS.append_chunk)
    tools.push({
      type:'function', name:'append_chunk',
      description:'Añade texto (chunk) al borrador indicado por draftId',
      parameters:{
        type:'object', required:['draftId','texto'],
        properties:{
          draftId:{type:'integer'},
          texto  :{type:'string',description:'Máx. 15 000 caracteres'}
        }
      }
    });

  if (LOCAL_FUNCTIONS.finalize_document)
    tools.push({
      type:'function', name:'finalize_document',
      description:'Genera el PDF con todos los chunks y devuelve la URL',
      parameters:{
        type:'object', required:['draftId'],
        properties:{ draftId:{type:'integer'} }
      }
    });
	
  /* ---------- LISTAR ARCHIVOS DE CARPETA ---------- */
  if (LOCAL_FUNCTIONS.list_files)
    tools.push({
      type:'function',
      name:'list_files',
      description:'Devuelve la lista de archivos dentro de una carpeta del servidor (images, documentos, etc.)',
      parameters:{
        type:'object',
        required:['folder'],
        properties:{
          folder:{
            type:'string',
            description:`Carpeta permitida. Ejemplos:
  - images
  - images/recursos
  - images/servicios
  - documentos
  - documentos/consentimientos`
          }
        }
      }
    });
	
  /* ---------- LISTAR /tmp ---------- */
  if (LOCAL_FUNCTIONS.list_tmp_files)
    tools.push({
      type       : 'function',
      name       : 'list_tmp_files',
      description: 'Devuelve la lista de archivos que hay en /tmp con su tmpName y origName',
      parameters : { type:'object', properties:{} }
    });
	
  /* ---------- LISTAR adjuntos paciente ---------- */
  if (LOCAL_FUNCTIONS.list_patient_files)
    tools.push({
      type:'function',
      name:'list_patient_files',
      description:'Lista los últimos N archivos guardados del paciente',
      parameters:{
        type:'object',
        properties:{ limit:{type:'integer',minimum:1,maximum:50,default:10} }
      }
    });

  if (LOCAL_FUNCTIONS.get_patient_file)
    tools.push({
      type:'function',
      name:'get_patient_file',
      description:'Devuelve ruta y nombre de un adjunto dado su id_file',
      parameters:{
        type:'object',
        required:['id_file'],
        properties:{ id_file:{type:'integer'} }
      }
    });
	
  return tools;
};