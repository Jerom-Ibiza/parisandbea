// utils/fisioOstioTemplates.js
//
//  Plantillas multilingües para el Consentimiento de Tratamientos
//  de Fisioterapia y Osteopatía de Paris & Bea.
//
//  Estructura general:
//
//  module.exports = {
//    es|en|de|fr : {
//      header        : string                       (título principal del PDF)
//
//      /*  Bloques de texto que se repiten tal cual  */
//      common : {
//        dataProtection  : string,
//        patientRights   : string,
//        declaration     : string
//      },
//
//      /*  Cuando el tratamiento EMPIEZA en Fisioterapia  */
//      physio : {
//        intro                 : string,            // párrafo introductorio
//        techniques            : string[],          // lista de técnicas
//        objective             : string,
//        benefits              : string,
//        sideEffects           : string,
//        alternatives          : string,
//        osteoContinuationIntro: string,            // puente a la parte de osteopatía
//        osteoAspects          : string[]           // lista de aspectos comunicados
//      },
//
//      /*  Cuando el tratamiento EMPIEZA en Osteopatía  */
//      osteo : {
//        intro                     : string,
//        osteoAspects              : string[],
//        afterOsteoIntro           : string,        // párrafo posterior
//        physioContinuationIntro   : string,
//        physioTechniquesIntro     : string,
//        techniques                : string[],      // mismas técnicas que arriba
//        objective                 : string,
//        benefits                  : string,
//        sideEffects               : string,
//        alternatives              : string
//      },
//
//      /*  Desglose WINBACK / CRYOBACK */
//      winback : {
//        tecar1 : string[],   // PROCEDIMIENTO
//        tecar2 : string[],   // CONSECUENCIAS SEGURAS
//        tecar3 : string[],   // CONTRAINDICACIONES
//        tecar4 : string[],   // EFECTOS SECUNDARIOS
//        cryo1  : string[],   // PROCEDIMIENTO
//        cryo2  : string[],   // CONTRAINDICACIONES
//        cryo3  : string[]    // EFECTOS SECUNDARIOS
//      }
//    }
//  }
//
//  El controlador rellenará la parte dinámica
//  (datos del centro, paciente, profesional, fechas, firmas…)
//  y elegirá el bloque physio u osteo según corresponda.
//

module.exports = {
    /* ─────────────────────────────────────────────────────────────
     *  ESPAÑOL
     * ──────────────────────────────────────────────────────────── */
    es: {
        header:
            'CONSENTIMIENTO INFORMADO Y ACEPTACIÓN DE SERVICIOS PROFESIONALES DE OSTEOPATÍA INTEGRAL Y FISIOTERAPIA',

        common: {
            dataProtection:
                'De conformidad con el Reglamento (UE) 2016/679 (RGPD) y la L.O. 3/2018, mis datos personales se tratarán con la máxima confidencialidad y exclusivamente para la gestión de mi historia clínica y la prestación de los servicios solicitados. Podré ejercer mis derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad.',

            patientRights:
                'En virtud de la Ley 41/2002, de 14 de noviembre, básica reguladora de la autonomía del paciente, se me ha facilitado información comprensible y veraz, y se garantizará mi intimidad y la protección de mi historia clínica.',

            declaration:
                'Declaro que he leído y comprendido la información contenida en este documento, que se han resuelto satisfactoriamente todas mis preguntas y que otorgo mi consentimiento informado para recibir tratamientos de fisioterapia y/o osteopatía en las condiciones descritas. Asimismo, entiendo que tengo derecho a retirar mi consentimiento y detener el tratamiento en cualquier momento.'
        },

        /*  Tratamiento que empieza en Fisioterapia  */
        physio: {
            intro:
                'El plan de tratamiento propuesto se inicia con Fisioterapia, disciplina de naturaleza sanitaria, que puede incluir, pero no se limita a, las siguientes técnicas de las que se me ha informado:',

            techniques: [
                'Evaluación física y funcional',
                'Terapias manuales',
                'Ejercicios terapéuticos',
                'Electroterapia',
                'Termoterapia y crioterapia',
                'Ultrasonido',
                'Vendaje neuromuscular',
                'Tratamientos con dispositivos SWINS S.A.S/WINBACK de acuerdo con los siguientes aspectos:'
            ],

            objective:
                'El objetivo del tratamiento es mejorar mi estado físico y funcional mediante técnicas de fisioterapia.',

            benefits:
                'Los beneficios esperados son el alivio del dolor, la mejora de la movilidad, la recuperación de la función y la prevención de lesiones.',

            sideEffects:
                'Los efectos secundarios potenciales podrían ser dolor temporal, hematomas, mareos, reacciones alérgicas a los materiales utilizados (vendajes, cremas, etc.).',

            alternatives:
                'Existen alternativas disponibles como tratamientos alternativos, incluidos medicamentos, cirugía u otros enfoques terapéuticos.',

            osteoContinuationIntro:
                'Y el tratamiento podría continuar con otras disciplinas como la Osteopatía, de naturaleza no sanitaria, aplicada por otros profesionales del centro, de acuerdo a los siguientes aspectos, de los cuales se me ha informado:',

            osteoAspects: [
                'La duración y periodicidad más aconsejable en mis circunstancias personales',
                'Los efectos razonablemente esperables',
                'Los costes económicos de la realización de las sesiones propuestas de Osteopatía',
                'Los beneficios físicos que pueden derivarse de la utilización y prestación de los servicios propuestos, al depender de múltiples factores y variables, no pueden garantizarse absolutamente en todos los casos',
                'Los servicios no sanitarios de Osteopatía no excluyen, ni sustituyen, cualquier tratamiento médico o farmacológico convencional, de manera que la aceptación de los servicios propuestos es una decisión voluntaria, libre y responsable',
                'La Osteopatía basa su práctica en la relajación y el equilibrio de la estructura musculoesquelética, craneal y visceral, todo ello de forma manual',
                'Durante la sesión, el profesional realizará una serie de test y palpaciones manuales, para identificar las estructuras que han sufrido pérdida de movimiento o estrés mecánico, y aplicará las técnicas manuales pertinentes, con el objetivo de normalizar la función y recuperar la elasticidad de los tejidos, reduciendo las molestias y favoreciendo la relajación y el equilibrio del sistema nervioso.'
            ]
        },

        /*  Tratamiento que empieza en Osteopatía  */
        osteo: {
            intro:
                'El plan de tratamiento propuesto se inicia con Osteopatía, disciplina de naturaleza no sanitaria, de acuerdo a los siguientes aspectos, de los cuales se me ha informado:',

            osteoAspects: [
                'La duración y periodicidad más aconsejable en mis circunstancias personales',
                'Los efectos razonablemente esperables',
                'Los costes económicos de la realización de las sesiones propuestas de Osteopatía',
                'Los beneficios físicos que pueden derivarse de la utilización y prestación de los servicios propuestos, al depender de múltiples factores y variables, no pueden garantizarse absolutamente en todos los casos',
                'Los servicios no sanitarios de Osteopatía no excluyen, ni sustituyen, cualquier tratamiento médico o farmacológico convencional, de manera que la aceptación de los servicios propuestos es una decisión voluntaria, libre y responsable',
                'La Osteopatía basa su práctica en la relajación y el equilibrio de la estructura musculoesquelética, craneal y visceral, todo ello de forma manual'
            ],

            afterOsteoIntro:
                'Durante la sesión, el profesional realizará una serie de test y palpaciones manuales, para identificar las estructuras que han sufrido pérdida de movimiento o estrés mecánico, y aplicará las técnicas manuales pertinentes, con el objetivo de normalizar la función y recuperar la elasticidad de los tejidos, reduciendo las molestias y favoreciendo la relajación y el equilibrio del sistema nervioso.',

            physioContinuationIntro:
                'Y el tratamiento podría continuar con otras disciplinas como la Fisioterapia, de naturaleza sanitaria, aplicada por otros profesionales del centro, que puede incluir, pero no se limita a, las siguientes técnicas de las que se me ha informado:',

            physioTechniquesIntro:
                'que puede incluir, pero no se limita a, las siguientes técnicas de las que se me ha informado:',

            techniques: [
                'Evaluación física y funcional',
                'Terapias manuales',
                'Ejercicios terapéuticos',
                'Electroterapia',
                'Termoterapia y crioterapia',
                'Ultrasonido',
                'Vendaje neuromuscular',
                'Tratamientos con dispositivo SWINS S.A.S/WINBACK de acuerdo con los siguientes aspectos y procedimientos:'
            ],

            objective:
                'El objetivo del tratamiento es mejorar mi estado físico y funcional mediante técnicas de fisioterapia.',

            benefits:
                'Los beneficios esperados son el alivio del dolor, la mejora de la movilidad, la recuperación de la función y la prevención de lesiones.',

            sideEffects:
                'Los efectos secundarios potenciales podrían ser dolor temporal, hematomas, mareos, reacciones alérgicas a los materiales utilizados (vendajes, cremas, etc.).',

            alternatives:
                'Existen alternativas disponibles como tratamientos alternativos, incluidos medicamentos, cirugía u otros enfoques terapéuticos.'
        },

        /*  Desglose WINBACK / CRYOBACK  */
        winback: {
            tecar1: [
                'TECAR (alta frecuencia), que estimula los mecanismos de cicatrización naturales del cuerpo y favorece la renovación celular',
                'HI-TENS (alta frecuencia con impulsos de baja frecuencia), que aumenta la potencia analgésica del TENS',
                'HI-EMS (media frecuencia modulada en bajas frecuencias), que contrae en profundidad los músculos para conseguir un refuerzo muscular y un drenaje'
            ],
            tecar2: [
                'Alivio de los dolores musculares y sintomáticos (agudos y crónicos)',
                'Relajación de los espasmos musculares',
                'Mejora de la cicatrización ósea relacionada con las patologías artrósicas',
                'Mejora de la movilidad de las funciones articulares',
                'Atención de las patologías musculares y tendinosas debidas a traumatismos',
                'Mejora de la microcirculación y del proceso de cicatrización',
                'Fortalecimiento muscular con un aumento de la flexibilidad'
            ],
            tecar3: [
                'Mujeres embarazadas',
                'Menores sin consentimiento del representante legal',
                'Cáncer y lesiones cancerosas',
                'Trastornos o lesiones en la piel (eccemas, quemaduras, heridas abiertas)',
                'Trastornos de la coagulación (Flebitis, Tromboflebitis)',
                'Insensibilidad al calor o al dolor',
                'Fiebre, infección bacteriana o enfermedad infecciosa',
                'Hipertensión o hipotensión grave',
                'Implantes eléctricos (marcapasos, bomba de insulina, neuroestimulador)'
            ],
            tecar4: [
                'En algunos casos, se puede sentir un aumento transitorio del dolor dentro de las 24 horas posteriores a la sesión si la intensidad es demasiado alta. Esta sensación desaparece de forma espontánea',
                'En casos muy raros, el paciente puede sufrir alergia a la crema conductiva o quemaduras superficiales',
                'En pocos casos, si se efectúa una terapia de cuerpo entero, se puede observar hipotensión reactiva'
            ],
            cryo1: [
                'Winback ha desarrollado el dispositivo CRYOBACK, el cual combina el frío intenso y la electroestimulación. La combinación de estas dos tecnologías permite la mejor penetración del frío, al tiempo que garantiza la máxima seguridad y una perfecta focalización de la zona tratada. Cada almohadilla (PAD) está equipada con dos sensores de temperatura que comprueban en tiempo real la temperatura de la zona de contacto.',
                'Es un procedimiento no invasivo, rápido y sin necesidad de preparación inicial',
                'Acciones localizadas y controladas gracias a las placas frías colocadas en la piel de la zona a tratar',
                'Estimulación muscular en paralelo con el efecto “crio”, permitiendo el reclutamiento de las fibras musculares y ofreciendo un fortalecimiento localizado de los tejidos',
                'Más confort durante el tratamiento gracias a la estimulación eléctrica que facilita la bajada de temperatura de la zona a tratar',
                'Un fortalecimiento muscular más cómodo gracias a la hipoestesia creada por el frío'
            ],
            cryo2: [
                'Embarazo o lactancia',
                'Epilepsia y pacientes con tumores',
                'Pacientes con inflamaciones agudas o enfermedades infecciosas',
                'Pacientes con heridas abiertas en la zona del tratamiento',
                'Pacientes con enfermedades cardíacas o renales, o diabetes severa',
                'Pacientes con enfermedades sanguíneas o con patologías que provocan debilidad física',
                'Pacientes con la piel dañada o afectada por enfermedad (psoriasis, eccemas)',
                'Pacientes con enfermedades que modifican la respuesta al frío o al calor',
                'Pacientes que se hayan sometido a una operación quirúrgica en los últimos meses',
                'Fiebre – Infección bacteriana – Enfermedad infecciosa',
                'Hipertensión o hipotensión grave',
                'Implantes eléctricos (marcapasos, bomba de insulina, neuroestimulador)'
            ],
            cryo3: [
                'Después del tratamiento, los tejidos tratados pueden aparecer rígidos temporalmente',
                'Enrojecimiento de la piel',
                'Después del tratamiento se puede experimentar mareo o cansancio',
                'Endurecimiento o insensibilidad de la zona tratada durante unas 48 horas',
                'En casos muy raros: quemaduras de la piel',
                'Alergia a la crema',
                'En algunos casos, durante las 24 horas posteriores al tratamiento, se puede sentir un resurgimiento transitorio del dolor'
            ]
        }
    },

    /* ─────────────────────────────────────────────────────────────
     *  ENGLISH
     * ──────────────────────────────────────────────────────────── */
    en: {
        header:
            'INFORMED CONSENT AND ACCEPTANCE OF PROFESSIONAL OSTEOPATHY & PHYSIOTHERAPY SERVICES',

        common: {
            dataProtection:
                'In accordance with Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018, my personal data will be processed in strict confidence and solely for managing my medical record and providing the requested services. I may exercise my rights of access, rectification, erasure, objection, restriction and portability.',

            patientRights:
                'Under Spanish Law 41/2002 on patient autonomy, I have been given truthful, comprehensible information and my privacy and clinical record will be protected.',

            declaration:
                'I declare that I have read and understood the information in this document, that all my questions have been satisfactorily answered, and that I give my informed consent to receive physiotherapy and/or osteopathy treatments under the conditions described. I also understand that I may withdraw my consent and stop the treatment at any time.'
        },

        physio: {
            intro:
                'The proposed treatment plan begins with Physiotherapy, a healthcare discipline, which may include—but is not limited to—the following techniques of which I have been informed:',

            techniques: [
                'Physical and functional assessment',
                'Manual therapies',
                'Therapeutic exercises',
                'Electrotherapy',
                'Thermotherapy and cryotherapy',
                'Ultrasound',
                'Kinesio taping',
                'Treatments with SWINS S.A.S/WINBACK devices in accordance with the following aspects:'
            ],

            objective:
                'The aim of the treatment is to improve my physical and functional condition through physiotherapy techniques.',

            benefits:
                'Expected benefits include pain relief, improved mobility, functional recovery and injury prevention.',

            sideEffects:
                'Potential side-effects may include temporary pain, bruising, dizziness or allergic reactions to the materials used (tapes, creams, etc.).',

            alternatives:
                'Alternative options are available, such as medication, surgery or other therapeutic approaches.',

            osteoContinuationIntro:
                'The treatment may subsequently continue with Osteopathy, a non-medical discipline, performed by other professionals at the centre, according to the following aspects about which I have been informed:',

            osteoAspects: [
                'Recommended duration and frequency in my personal circumstances',
                'Reasonably expected effects',
                'Economic cost of the proposed osteopathy sessions',
                'Physical benefits cannot be absolutely guaranteed, as they depend on multiple factors and variables',
                'Non-medical osteopathy services do not exclude or replace any conventional medical or pharmacological treatment; acceptance of the proposed services is a voluntary, free and responsible decision',
                'Osteopathy is based on relaxing and balancing the musculoskeletal, cranial and visceral structure using manual techniques',
                'During the session the practitioner will carry out tests and manual palpations to identify structures that have lost mobility or are under mechanical stress, and will apply the pertinent manual techniques with the aim of normalising function and restoring tissue elasticity, reducing discomfort and promoting relaxation and balance of the nervous system.'
            ]
        },

        osteo: {
            intro:
                'The proposed treatment plan begins with Osteopathy, a non-medical discipline, according to the following aspects of which I have been informed:',

            osteoAspects: [
                'Recommended duration and frequency in my personal circumstances',
                'Reasonably expected effects',
                'Economic cost of the proposed osteopathy sessions',
                'Physical benefits cannot be absolutely guaranteed, as they depend on multiple factors and variables',
                'Non-medical osteopathy services do not exclude or replace any conventional medical or pharmacological treatment; acceptance of the proposed services is a voluntary, free and responsible decision',
                'Osteopathy is based on relaxing and balancing the musculoskeletal, cranial and visceral structure using manual techniques'
            ],

            afterOsteoIntro:
                'During the session the practitioner will carry out tests and manual palpations to identify structures that have lost mobility or are under mechanical stress, and will apply the pertinent manual techniques with the aim of normalising function and restoring tissue elasticity, reducing discomfort and promoting relaxation and balance of the nervous system.',

            physioContinuationIntro:
                'The treatment may then continue with Physiotherapy, a healthcare discipline, delivered by other professionals at the centre, which may include—but is not limited to—the following techniques of which I have been informed:',

            physioTechniquesIntro:
                'which may include—but is not limited to—the following techniques of which I have been informed:',

            techniques: [
                'Physical and functional assessment',
                'Manual therapies',
                'Therapeutic exercises',
                'Electrotherapy',
                'Thermotherapy and cryotherapy',
                'Ultrasound',
                'Kinesio taping',
                'Treatments with SWINS S.A.S/WINBACK devices according to the following aspects and procedures:'
            ],

            objective:
                'The aim of the treatment is to improve my physical and functional condition through physiotherapy techniques.',

            benefits:
                'Expected benefits include pain relief, improved mobility, functional recovery and injury prevention.',

            sideEffects:
                'Potential side-effects may include temporary pain, bruising, dizziness or allergic reactions to the materials used (tapes, creams, etc.).',

            alternatives:
                'Alternative options are available, such as medication, surgery or other therapeutic approaches.'
        },

        winback: {
            tecar1: [
                'TECAR (high frequency) which stimulates the body’s natural healing mechanisms and promotes cellular renewal',
                'HI-TENS (high frequency with low-frequency pulses) which boosts the analgesic power of TENS',
                'HI-EMS (medium frequency modulated into low frequencies) which deeply contracts muscles to achieve strengthening and drainage'
            ],
            tecar2: [
                'Relief of muscular and symptomatic pain (acute and chronic)',
                'Relaxation of muscle spasms',
                'Improved bone healing related to osteoarthritic pathologies',
                'Improved mobility of joint functions',
                'Management of muscular and tendinous pathologies arising from trauma',
                'Improved micro-circulation and healing process',
                'Muscle strengthening with increased flexibility'
            ],
            tecar3: [
                'Pregnant women',
                'Minors without legal-guardian consent',
                'Cancer and cancerous lesions',
                'Skin disorders or lesions (eczema, burns, open wounds)',
                'Coagulation disorders (phlebitis, thrombophlebitis)',
                'Insensitivity to heat or pain',
                'Fever, bacterial infection or infectious disease',
                'Severe hypertension or hypotension',
                'Electrical implants (pacemaker, insulin pump, neurostimulator)'
            ],
            tecar4: [
                'In some cases a transient increase in pain may be felt within 24 h after the session if the intensity is too high; this disappears spontaneously',
                'In very rare cases the patient may be allergic to the conductive cream or suffer superficial burns',
                'In a few cases, if whole-body therapy is performed, reactive hypotension may be observed'
            ],
            cryo1: [
                'Winback has developed the CRYOBACK device combining intense cold and electro-stimulation. This combination allows optimal cold penetration while ensuring maximum safety and precise targeting of the treated area. Each pad is equipped with two temperature sensors that monitor the skin surface in real time.',
                'A non-invasive, quick procedure with no initial preparation required',
                'Localised, controlled action thanks to cold plates placed on the skin over the treatment area',
                'Muscle stimulation in parallel with the “cryo” effect, enabling recruitment of muscle fibres and offering localised tissue strengthening',
                'Greater comfort during treatment thanks to electro-stimulation, which facilitates the temperature drop in the treatment area',
                'More comfortable muscle strengthening thanks to the cold-induced hypoesthesia'
            ],
            cryo2: [
                'Pregnancy or breastfeeding',
                'Epilepsy and patients with tumours',
                'Patients with acute inflammation or infectious diseases',
                'Patients with open wounds in the treatment area',
                'Patients with heart or kidney disease, or severe diabetes',
                'Patients with blood disorders or conditions causing physical weakness',
                'Patients with damaged skin or skin disease (psoriasis, eczema)',
                'Patients with conditions that alter the response to cold or heat',
                'Patients who have undergone surgery in recent months',
                'Fever – bacterial infection – infectious disease',
                'Severe hypertension or hypotension',
                'Electrical implants (pacemaker, insulin pump, neurostimulator)'
            ],
            cryo3: [
                'After treatment, the treated tissues may temporarily appear stiff',
                'Skin redness',
                'Dizziness or tiredness may be experienced after treatment',
                'Hardening or numbness of the treated area for about 48 hours',
                'Very rare cases: skin burns',
                'Cream allergy',
                'In some cases, within 24 hours after treatment, a transient resurgence of pain may be felt'
            ]
        }
    },

    /* ----------------------------------------------------------------
     *  DEUTSCH
     * ---------------------------------------------------------------- */
    de: {
        header:
            'AUFKLÄRUNG UND EINWILLIGUNG ZU LEISTUNGEN DER OSTEOPATHIE UND PHYSIOTHERAPIE',

        common: {
            dataProtection:
                'Gemäß Verordnung (EU) 2016/679 (DSGVO) und dem spanischen Organgesetz 3/2018 werden meine personenbezogenen Daten streng vertraulich und ausschließlich zur Verwaltung meiner Krankenakte und zur Erbringung der angeforderten Leistungen verarbeitet. Ich kann meine Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Übertragbarkeit ausüben.',

            patientRights:
                'Nach spanischem Gesetz 41/2002 über die Patientenautonomie wurden mir wahrheitsgemäße und verständliche Informationen erteilt; meine Privatsphäre und meine Krankenakte werden geschützt.',

            declaration:
                'Ich erkläre, dass ich die Informationen in diesem Dokument gelesen und verstanden habe, dass alle meine Fragen zufriedenstellend beantwortet wurden und dass ich meine ausdrückliche Einwilligung erteile, physiotherapeutische und/oder osteopathische Behandlungen unter den beschriebenen Bedingungen zu erhalten. Mir ist bewusst, dass ich meine Einwilligung jederzeit widerrufen und die Behandlung beenden kann.'
        },

        physio: {
            intro:
                'Der vorgeschlagene Behandlungsplan beginnt mit Physiotherapie, einer medizinischen Disziplin, die – jedoch nicht ausschließlich – folgende Techniken umfasst, über die ich informiert wurde:',

            techniques: [
                'Körperliche und funktionelle Befundung',
                'Manuelle Therapien',
                'Therapeutische Übungen',
                'Elektrotherapie',
                'Thermo- und Kryotherapie',
                'Ultraschall',
                'Kinesiologisches Taping',
                'Behandlungen mit SWINS S.A.S/WINBACK-Geräten gemäß den folgenden Aspekten:'
            ],

            objective:
                'Ziel der Behandlung ist es, meinen körperlichen und funktionellen Zustand mittels physiotherapeutischer Techniken zu verbessern.',

            benefits:
                'Erwartete Vorteile sind Schmerzlinderung, verbesserte Beweglichkeit, Funktionswiederherstellung und Verletzungsprävention.',

            sideEffects:
                'Mögliche Nebenwirkungen sind vorübergehende Schmerzen, Hämatome, Schwindel oder allergische Reaktionen auf verwendete Materialien (Tapes, Cremes usw.).',

            alternatives:
                'Es gibt alternative Optionen wie Medikamente, Operationen oder andere therapeutische Ansätze.',

            osteoContinuationIntro:
                'Die Behandlung kann anschließend mit Osteopathie, einer nicht-medizinischen Disziplin, fortgesetzt werden; folgende Punkte wurden mir hierzu erläutert:',

            osteoAspects: [
                'Empfohlene Dauer und Häufigkeit in meinen persönlichen Umständen',
                'Vernünftigerweise zu erwartende Wirkungen',
                'Wirtschaftliche Kosten der vorgeschlagenen Osteopathie-Sitzungen',
                'Physische Nutzen können nicht absolut garantiert werden, da sie von vielen Faktoren abhängen',
                'Osteopathische Leistungen ersetzen keine konventionellen medizinischen oder pharmazeutischen Behandlungen; die Inanspruchnahme erfolgt freiwillig und eigenverantwortlich',
                'Die Osteopathie beruht auf manueller Entspannung und Balance des muskel-skelettalen, cranialen und viszeralen Systems',
                'Während der Sitzung führt die Fachkraft Tests und manuelle Palpationen durch, um Strukturen mit eingeschränkter Beweglichkeit zu identifizieren, und wendet geeignete Techniken an, um Funktion und Elastizität wiederherzustellen, Beschwerden zu lindern und das Nervensystem zu entspannen und auszugleichen.'
            ]
        },

        osteo: {
            intro:
                'Der vorgeschlagene Behandlungsplan beginnt mit Osteopathie, einer nicht-medizinischen Disziplin; folgende Punkte wurden mir hierzu erläutert:',

            osteoAspects: [
                'Empfohlene Dauer und Häufigkeit in meinen persönlichen Umständen',
                'Vernünftigerweise zu erwartende Wirkungen',
                'Wirtschaftliche Kosten der vorgeschlagenen Osteopathie-Sitzungen',
                'Physische Nutzen können nicht absolut garantiert werden, da sie von vielen Faktoren abhängen',
                'Osteopathische Leistungen ersetzen keine konventionellen medizinischen oder pharmazeutischen Behandlungen; die Inanspruchnahme erfolgt freiwillig und eigenverantwortlich',
                'Die Osteopathie beruht auf manueller Entspannung und Balance des muskel-skelettalen, cranialen und viszeralen Systems'
            ],

            afterOsteoIntro:
                'Während der Sitzung führt die Fachkraft Tests und manuelle Palpationen durch, um Strukturen mit eingeschränkter Beweglichkeit zu identifizieren, und wendet geeignete Techniken an, um Funktion und Elastizität wiederherzustellen, Beschwerden zu lindern und das Nervensystem zu entspannen und auszugleichen.',

            physioContinuationIntro:
                'Die Behandlung kann anschließend mit Physiotherapie, einer medizinischen Disziplin, fortgesetzt werden; diese kann – jedoch nicht ausschließlich – folgende Techniken umfassen, über die ich informiert wurde:',

            physioTechniquesIntro:
                'die – jedoch nicht ausschließlich – folgende Techniken umfassen, über die ich informiert wurde:',

            techniques: [
                'Körperliche und funktionelle Befundung',
                'Manuelle Therapien',
                'Therapeutische Übungen',
                'Elektrotherapie',
                'Thermo- und Kryotherapie',
                'Ultraschall',
                'Kinesiologisches Taping',
                'Behandlungen mit SWINS S.A.S/WINBACK-Geräten gemäß den folgenden Aspekten und Verfahren:'
            ],

            objective:
                'Ziel der Behandlung ist es, meinen körperlichen und funktionellen Zustand mittels physiotherapeutischer Techniken zu verbessern.',

            benefits:
                'Erwartete Vorteile sind Schmerzlinderung, verbesserte Beweglichkeit, Funktionswiederherstellung und Verletzungsprävention.',

            sideEffects:
                'Mögliche Nebenwirkungen sind vorübergehende Schmerzen, Hämatome, Schwindel oder allergische Reaktionen auf verwendete Materialien (Tapes, Cremes usw.).',

            alternatives:
                'Es gibt alternative Optionen wie Medikamente, Operationen oder andere therapeutische Ansätze.'
        },

        winback: {
            tecar1: [
                'TECAR (Hochfrequenz) stimuliert die natürlichen Heilungsmechanismen des Körpers und fördert die Zellregeneration',
                'HI-TENS (Hochfrequenz mit niederfrequenten Impulsen) verstärkt die analgetische Wirkung des TENS',
                'HI-EMS (Mittelfrequenz, moduliert in Niedrigfrequenzen) kontrahiert die Muskulatur in der Tiefe, um Kräftigung und Drainage zu erzielen'
            ],
            tecar2: [
                'Linderung von Muskel- und Symptomschmerzen (akut und chronisch)',
                'Entspannung von Muskelkrämpfen',
                'Verbesserte Knochenheilung bei arthrotischen Pathologien',
                'Verbesserte Gelenkbeweglichkeit',
                'Behandlung von muskulären und tendinösen Traumata',
                'Verbesserte Mikrozirkulation und Wundheilung',
                'Muskelkräftigung mit erhöhter Flexibilität'
            ],
            tecar3: [
                'Schwangere Frauen',
                'Minderjährige ohne Zustimmung des gesetzlichen Vertreters',
                'Krebs und krebsartige Läsionen',
                'Hautstörungen oder -verletzungen (Ekzeme, Verbrennungen, offene Wunden)',
                'Gerinnungsstörungen (Phlebitis, Thrombophlebitis)',
                'Keine Wärme- oder Schmerzempfindung',
                'Fieber, bakterielle Infektion oder Infektionskrankheit',
                'Schwere Hyper- oder Hypotonie',
                'Elektrische Implantate (Herzschrittmacher, Insulinpumpe, Neurostimulator)'
            ],
            tecar4: [
                'In einigen Fällen kann 24 h nach der Sitzung ein vorübergehender Schmerzanstieg auftreten, wenn die Intensität zu hoch war; dieser verschwindet spontan',
                'In sehr seltenen Fällen Allergie gegen die Kontaktcreme oder oberflächliche Verbrennungen',
                'Bei Ganzkörperanwendungen kann in wenigen Fällen eine reaktive Hypotonie auftreten'
            ],
            cryo1: [
                'Winback hat das CRYOBACK-Gerät entwickelt, das intensive Kälte und Elektrostimulation kombiniert. Diese Kombination ermöglicht eine optimale Kältepenetration bei höchster Sicherheit und präziser Fokussierung des Behandlungsbereichs. Jede Pad-Elektrode verfügt über zwei Temperatursensoren, die die Hautoberfläche in Echtzeit überwachen.',
                'Nicht-invasives, schnelles Verfahren ohne notwendige Vorbereitung',
                'Lokalisierte und kontrollierte Wirkung dank Kälteplatten auf der Haut der Behandlungszone',
                'Gleichzeitige Muskelstimulation mit dem „Kryo“-Effekt, Rekrutierung von Muskelfasern und lokalisierte Gewebekräftigung',
                'Mehr Komfort durch Elektrostimulation, die den Temperaturabfall erleichtert',
                'Angenehmere Muskelkräftigung dank der durch Kälte verursachten Hypästhesie'
            ],
            cryo2: [
                'Schwangerschaft oder Stillzeit',
                'Epilepsie und Patienten mit Tumoren',
                'Akute Entzündungen oder Infektionskrankheiten',
                'Offene Wunden im Behandlungsbereich',
                'Herz- oder Nierenerkrankungen oder schwere Diabetes',
                'Bluterkrankungen oder Zustände mit ausgeprägter körperlicher Schwäche',
                'Beschädigte Haut oder Hautkrankheiten (Psoriasis, Ekzeme)',
                'Erkrankungen, die die Reaktion auf Kälte oder Wärme verändern',
                'Operationen in den letzten Monaten',
                'Fieber – bakterielle Infektion – Infektionskrankheit',
                'Schwere Hyper- oder Hypotonie',
                'Elektrische Implantate (Herzschrittmacher, Insulinpumpe, Neurostimulator)'
            ],
            cryo3: [
                'Nach der Behandlung können die behandelten Gewebe vorübergehend verhärtet erscheinen',
                'Rötung der Haut',
                'Schwindel oder Müdigkeit nach der Behandlung',
                'Verhärtung oder Taubheit des behandelten Bereichs für ca. 48 Stunden',
                'Sehr selten: Hautverbrennungen',
                'Allergie gegen die Creme',
                'In einigen Fällen kann innerhalb von 24 Stunden nach der Behandlung ein vorübergehender Schmerzanstieg auftreten'
            ]
        }
    },

    /* ----------------------------------------------------------------
     *  FRANÇAIS
     * ---------------------------------------------------------------- */
    fr: {
        header:
            'CONSENTEMENT ÉCLAIRÉ ET ACCEPTATION DES SOINS D’OSTÉOPATHIE ET DE PHYSIOTHÉRAPIE',

        common: {
            dataProtection:
                'Conformément au Règlement (UE) 2016/679 (RGPD) et à la Loi organique espagnole 3/2018, mes données personnelles seront traitées en toute confidentialité et uniquement pour la gestion de mon dossier médical et la prestation des services sollicités. Je peux exercer mes droits d’accès, de rectification, d’effacement, d’opposition, de limitation et de portabilité.',

            patientRights:
                'En vertu de la Loi espagnole 41/2002 sur l’autonomie du patient, des informations véridiques et compréhensibles m’ont été fournies ; ma vie privée et mon dossier médical seront protégés.',

            declaration:
                'Je déclare avoir lu et compris les informations contenues dans ce document, que toutes mes questions ont reçu une réponse satisfaisante et que je donne mon consentement éclairé pour recevoir des traitements de physiothérapie et/ou d’ostéopathie dans les conditions décrites. Je comprends également que je peux retirer mon consentement et interrompre le traitement à tout moment.'
        },

        physio: {
            intro:
                'Le plan de traitement proposé commence par la physiothérapie, discipline de santé, qui peut inclure – sans s’y limiter – les techniques suivantes dont j’ai été informé :',

            techniques: [
                'Évaluation physique et fonctionnelle',
                'Thérapies manuelles',
                'Exercices thérapeutiques',
                'Électrothérapie',
                'Thermothérapie et cryothérapie',
                'Ultrasons',
                'Bandage neuromusculaire',
                'Traitements avec dispositifs SWINS S.A.S/WINBACK selon les aspects suivants :'
            ],

            objective:
                'L’objectif du traitement est d’améliorer mon état physique et fonctionnel grâce aux techniques de physiothérapie.',

            benefits:
                'Les bénéfices attendus sont le soulagement de la douleur, l’amélioration de la mobilité, la récupération fonctionnelle et la prévention des blessures.',

            sideEffects:
                'Les effets indésirables potentiels peuvent inclure douleur temporaire, ecchymoses, vertiges ou réactions allergiques aux matériaux utilisés (bandages, crèmes, etc.).',

            alternatives:
                'Des alternatives sont disponibles, comme les médicaments, la chirurgie ou d’autres approches thérapeutiques.',

            osteoContinuationIntro:
                'Le traitement peut ensuite se poursuivre par l’ostéopathie, discipline non sanitaire, appliquée par d’autres professionnels du centre, selon les aspects suivants qui m’ont été expliqués :',

            osteoAspects: [
                'La durée et la fréquence recommandées selon ma situation personnelle',
                'Les effets raisonnablement prévisibles',
                'Le coût économique des séances proposées d’ostéopathie',
                'Les bénéfices physiques ne peuvent être garantis de façon absolue, car ils dépendent de nombreux facteurs et variables',
                'Les services d’ostéopathie, non sanitaires, n’excluent ni ne remplacent aucun traitement médical ou pharmacologique conventionnel ; l’acceptation des services proposés est une décision volontaire, libre et responsable',
                'L’ostéopathie repose sur la relaxation et l’équilibre de la structure musculo-squelettique, crânienne et viscérale, le tout de manière manuelle',
                'Au cours de la séance, le professionnel effectuera des tests et palpations manuelles pour identifier les structures ayant perdu de la mobilité ou subissant un stress mécanique, et appliquera les techniques manuelles appropriées afin de normaliser la fonction, restaurer l’élasticité des tissus, réduire l’inconfort et favoriser la relaxation et l’équilibre du système nerveux.'
            ]
        },

        osteo: {
            intro:
                'Le plan de traitement proposé commence par l’ostéopathie, discipline non sanitaire, selon les aspects suivants qui m’ont été expliqués :',

            osteoAspects: [
                'La durée et la fréquence recommandées selon ma situation personnelle',
                'Les effets raisonnablement prévisibles',
                'Le coût économique des séances proposées d’ostéopathie',
                'Les bénéfices physiques ne peuvent être garantis de façon absolue, car ils dépendent de nombreux facteurs et variables',
                'Les services d’ostéopathie, non sanitaires, n’excluent ni ne remplacent aucun traitement médical ou pharmacologique conventionnel ; l’acceptation des services proposés est une décision volontaire, libre et responsable',
                'L’ostéopathie repose sur la relaxation et l’équilibre de la structure musculo-squelettique, crânienne et viscérale, le tout de manière manuelle'
            ],

            afterOsteoIntro:
                'Au cours de la séance, le professionnel effectuera des tests et palpations manuelles pour identifier les structures ayant perdu de la mobilité ou subissant un stress mécanique, et appliquera les techniques manuelles appropriées afin de normaliser la fonction, restaurer l’élasticité des tissus, réduire l’inconfort et favoriser la relaxation et l’équilibre du système nerveux.',

            physioContinuationIntro:
                'Le traitement pourra ensuite se poursuivre par la physiothérapie, discipline de santé, assurée par d’autres professionnels du centre, pouvant inclure – sans s’y limiter – les techniques suivantes dont j’ai été informé :',

            physioTechniquesIntro:
                'pouvant inclure – sans s’y limiter – les techniques suivantes dont j’ai été informé :',

            techniques: [
                'Évaluation physique et fonctionnelle',
                'Thérapies manuelles',
                'Exercices thérapeutiques',
                'Électrothérapie',
                'Thermothérapie et cryothérapie',
                'Ultrasons',
                'Bandage neuromusculaire',
                'Traitements avec dispositifs SWINS S.A.S/WINBACK selon les aspects et procédures suivants :'
            ],

            objective:
                'L’objectif du traitement est d’améliorer mon état physique et fonctionnel grâce aux techniques de physiothérapie.',

            benefits:
                'Les bénéfices attendus sont le soulagement de la douleur, l’amélioration de la mobilité, la récupération fonctionnelle et la prévention des blessures.',

            sideEffects:
                'Les effets indésirables potentiels peuvent inclure douleur temporaire, ecchymoses, vertiges ou réactions allergiques aux matériaux utilisés (bandages, crèmes, etc.).',

            alternatives:
                'Des alternatives sont disponibles, comme les médicaments, la chirurgie ou d’autres approches thérapeutiques.'
        },

        winback: {
            tecar1: [
                'TECAR (haute fréquence) qui stimule les mécanismes naturels de cicatrisation du corps et favorise le renouvellement cellulaire',
                'HI-TENS (haute fréquence à impulsions basses) qui augmente le pouvoir analgésique du TENS',
                'HI-EMS (moyenne fréquence modulée en basses fréquences) qui contracte en profondeur les muscles afin d’obtenir un renforcement et un drainage'
            ],
            tecar2: [
                'Soulagement des douleurs musculaires et symptomatiques (aiguës et chroniques)',
                'Relaxation des spasmes musculaires',
                'Amélioration de la consolidation osseuse liée aux pathologies arthrosiques',
                'Amélioration de la mobilité articulaire',
                'Prise en charge des pathologies musculaires et tendineuses dues à des traumatismes',
                'Amélioration de la micro-circulation et du processus de cicatrisation',
                'Renforcement musculaire avec augmentation de la flexibilité'
            ],
            tecar3: [
                'Femmes enceintes',
                'Mineurs sans consentement du représentant légal',
                'Cancer et lésions cancéreuses',
                'Troubles ou lésions cutanés (eczéma, brûlures, plaies ouvertes)',
                'Troubles de la coagulation (phlébite, thrombophlébite)',
                'Insensibilité à la chaleur ou à la douleur',
                'Fièvre, infection bactérienne ou maladie infectieuse',
                'Hypertension ou hypotension sévère',
                'Implants électriques (pacemaker, pompe à insuline, neurostimulateur)'
            ],
            tecar4: [
                'Dans certains cas, une augmentation transitoire de la douleur peut être ressentie dans les 24 heures suivant la séance si l’intensité est trop élevée ; cette sensation disparaît spontanément',
                'Dans de très rares cas, le patient peut être allergique à la crème conductrice ou souffrir de brûlures superficielles',
                'Dans quelques cas, si une thérapie corps entier est effectuée, une hypotension réactionnelle peut être observée'
            ],
            cryo1: [
                'Winback a développé l’appareil CRYOBACK qui combine le froid intense et l’électrostimulation. Cette combinaison permet une meilleure pénétration du froid tout en garantissant une sécurité maximale et une mise au point parfaite de la zone traitée. Chaque coussinet (PAD) est équipé de deux capteurs de température qui contrôlent en temps réel la température de la zone de contact.',
                'Procédure non invasive, rapide et sans préparation préalable',
                'Action localisée et contrôlée grâce aux plaques froides placées sur la peau de la zone à traiter',
                'Stimulation musculaire parallèlement à l’effet « cryo », permettant le recrutement des fibres musculaires et offrant un renforcement localisé des tissus',
                'Plus de confort pendant le traitement grâce à l’électrostimulation qui facilite la baisse de température de la zone traitée',
                'Renforcement musculaire plus confortable grâce à l’hypoesthésie créée par le froid'
            ],
            cryo2: [
                'Grossesse ou allaitement',
                'Épilepsie et patients atteints de tumeurs',
                'Patients présentant des inflammations aiguës ou des maladies infectieuses',
                'Patients ayant des plaies ouvertes dans la zone de traitement',
                'Patients souffrant de maladies cardiaques ou rénales, ou de diabète sévère',
                'Patients atteints de maladies sanguines ou de conditions provoquant une faiblesse physique',
                'Patients ayant la peau lésée ou atteinte d’une maladie (psoriasis, eczéma)',
                'Patients atteints de maladies modifiant la réponse au froid ou à la chaleur',
                'Patients opérés au cours des derniers mois',
                'Fièvre – infection bactérienne – maladie infectieuse',
                'Hypertension ou hypotension sévère',
                'Implants électriques (pacemaker, pompe à insuline, neurostimulateur)'
            ],
            cryo3: [
                'Après le traitement, les tissus traités peuvent paraître temporairement rigides',
                'Rougeur de la peau',
                'Une sensation de vertige ou de fatigue peut être ressentie après le traitement',
                'Durcissement ou engourdissement de la zone traitée pendant environ 48 heures',
                'Cas très rares : brûlures cutanées',
                'Allergie à la crème',
                'Dans certains cas, une recrudescence transitoire de la douleur peut être ressentie dans les 24 heures suivant le traitement'
            ]
        }
    }
};
