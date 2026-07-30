const COMMON_MEDICAL_PROMPT =
  'Mündliches medizinisches Fachgespräch auf Deutsch. Erkenne medizinische Fachbegriffe, Abkürzungen, Laborwerte, Diagnosen, Therapien und Eigennamen korrekt. Häufige Begriffe: Anamnese, Befund, Differentialdiagnose, Ätiologie, Pathogenese, Sonographie, CT, MRT, EKG, Labor, CRP, HbA1c, eGFR, Kreatinin, Hämoglobin, Leukozyten, Thrombozyten.';

const MEDICAL_PROMPTS: Record<string, string> = {
  allgemein_viszeralchirurgie:
    'Appendizitis, Cholezystitis, Cholelithiasis, Pankreatitis, Divertikulitis, Ileus, Peritonitis, Leistenhernie, Narbenhernie, Anastomose, Laparoskopie, Laparotomie, Sigmaresektion, Hemikolektomie, Cholezystektomie, Appendektomie, Whipple-Operation, Stoma, Kolostoma, Ileostoma, Kolonkarzinom, Rektumkarzinom, Pankreaskarzinom, TNM-Klassifikation.',
  allgemeinmedizin:
    'SGLT-2-Hemmer, GLP-1-Rezeptoragonist, DPP-4-Inhibitor, ACE-Hemmer, AT1-Antagonist, Betablocker, NOAC, Marcumar, PPI, Metformin, L-Thyroxin, DEGAM, NVL, Hausbesuch, Multimorbidität, Polypharmazie, Diabetes mellitus, arterielle Hypertonie, COPD, Herzinsuffizienz, Vorhofflimmern, CKD, Prävention, Impfung, STIKO.',
  anaesthesie_intensiv_notfall_schmerz:
    'Intubation, RSI, Larynxmaske, Videolaryngoskopie, Beatmung, PEEP, FiO2, SpO2, Extubation, Weaning, Propofol, Midazolam, Sufentanil, Ketamin, Rocuronium, Sugammadex, Spinalanästhesie, Epiduralanästhesie, PDK, Norepinephrin, ZVK, PICCO, CVVHD, Sepsis, ARDS, CPR, ROSC, GCS, Polytrauma.',
  angiologie:
    'pAVK, periphere arterielle Verschlusskrankheit, Fontaine-Stadium, Claudicatio intermittens, kritische Ischämie, tiefe Beinvenenthrombose, TVT, Lungenembolie, Phlebothrombose, Raynaud-Syndrom, ABI-Messung, Duplexsonographie, Angiographie, Vena saphena magna, Varikosis, Thrombophilie, Faktor-V-Leiden, Kompressionstherapie.',
  dermatologie_venerologie:
    'Melanom, malignes Melanom, ABCDE-Regel, Breslow-Index, Basaliom, Plattenepithelkarzinom, Aktinische Keratose, Dermatoskopie, Naevus, Psoriasis, Ekzem, Neurodermitis, Urtikaria, Quincke-Ödem, Tinea, Onychomykose, Lichen ruber, Rosacea, Dupilumab, Syphilis, Gonorrhoe, Chlamydien, HPV, Condylomata acuminata, TPPA.',
  diabetologie:
    'Diabetes mellitus Typ 1, Typ 2, MODY, Gestationsdiabetes, LADA, HbA1c, oGTT, Insulinpumpe, CGM, Basalrate, Bolus, ICT, Hypoglykämie, Ketoazidose, DKA, Metformin, SGLT-2-Hemmer, GLP-1-Rezeptoragonist, Basalinsulin, diabetische Nephropathie, Retinopathie, Neuropathie, diabetischer Fuß, Mikroalbuminurie.',
  endokrinologie_stoffwechsel:
    'Hypothyreose, Hyperthyreose, Morbus Basedow, Hashimoto-Thyreoiditis, Struma, TSH, fT3, fT4, TPO-Antikörper, TRAK, Radiojodtherapie, L-Thyroxin, Thiamazol, Hyperparathyreoidismus, Cushing-Syndrom, Conn-Syndrom, Morbus Addison, Phäochromozytom, Dexamethason-Hemmtest, ACTH, Akromegalie, Prolaktinom, SIADH.',
  gastroenterologie:
    'Gastroskopie, Koloskopie, ÖGD, ERCP, MRCP, Polypektomie, EMR, ESD, Barrett-Ösophagus, Refluxkrankheit, Achalasie, Helicobacter pylori, Ulcus ventriculi, Morbus Crohn, Colitis ulcerosa, CED, Zöliakie, Leberzirrhose, Child-Pugh-Score, MELD-Score, Aszites, SBP, Ösophagusvarizen, PSC, PBC, Calprotectin.',
  geriatrie:
    'Multimorbidität, Polypharmazie, Frailty, Sarkopenie, Sturzrisiko, Hüftfraktur, Delir, Demenz, Alzheimer-Demenz, Lewy-Körper-Demenz, MMSE, MoCA, geriatrisches Assessment, Barthel-Index, Timed Up and Go, Dysphagie, Mangelernährung, Dekubitus, Inkontinenz, PRISCUS-Liste, Beers-Kriterien, Patientenverfügung.',
  gefaesschirurgie:
    'pAVK, Aortenaneurysma, Bauchaortenaneurysma, BAA, Aortendissektion, Stanford-Klassifikation, DeBakey-Klassifikation, Karotisstenose, Karotisendarteriektomie, TEA, Bypass, PTFE-Interponat, Dacron-Prothese, AV-Fistel, Dialyseshunt, Crossektomie, Duplexsonographie, DSA, EVAR, TEVAR, Embolektomie, Thrombektomie, Fasziotomie, Amputation.',
  gynaekologie_geburtshilfe:
    'Mammakarzinom, HER2, Hormonrezeptor, BRCA1, BRCA2, Mammographie, Sentinel-Lymphknoten, Mastektomie, Endometriose, PCOS, Endometriumkarzinom, Ovarialkarzinom, Zervixkarzinom, CIN, PAP-Abstrich, Kolposkopie, HPV, Konisation, Hysterektomie, HCG, Präeklampsie, Eklampsie, HELLP-Syndrom, CTG, Sectio caesarea.',
  haematologie_onkologie:
    'Anämie, Eisenmangelanämie, Leukopenie, Neutropenie, Thrombozytopenie, AML, CML, ALL, CLL, Lymphom, multiples Myelom, MDS, MPN, Polycythaemia vera, Knochenmarkpunktion, Flowzytometrie, BCR-ABL, JAK2-Mutation, Chemotherapie, Immuntherapie, Checkpoint-Inhibitor, PD-L1, CAR-T-Zell-Therapie, Stammzelltransplantation, GvHD, G-CSF.',
  infektiologie:
    'Sepsis, septischer Schock, SIRS, qSOFA, SOFA-Score, Bakteriämie, Antibiotikatherapie, Deeskalation, Piperacillin-Tazobactam, Meropenem, Ceftriaxon, Vancomycin, Daptomycin, Linezolid, MRSA, VRE, ESBL, 3MRGN, 4MRGN, Clostridioides difficile, HIV, ART, Hepatitis B, Hepatitis C, Tuberkulose, Liquorpunktion, Blutkultur, Antibiogramm, MHK.',
  innere_medizin:
    'Herzinsuffizienz, HFrEF, HFpEF, STEMI, NSTEMI, Troponin, BNP, NT-proBNP, arterielle Hypertonie, Vorhofflimmern, CHA2DS2-VASc-Score, Lungenembolie, tiefe Beinvenenthrombose, Wells-Score, COPD, FEV1, Pneumonie, CRB-65-Score, Diabetes mellitus, Leberzirrhose, Aszites, BGA, D-Dimere, Koronarangiographie.',
  kardiologie:
    'STEMI, NSTEMI, ACS, Troponin, CK-MB, Echokardiographie, TTE, TEE, LVEF, Aortenstenose, Mitralinsuffizienz, Vorhofflimmern, Vorhofflattern, AV-Block, Kardioversion, Ablation, Pulmonalvenenisolation, Herzkatheter, Koronarangiographie, PTCA, DES, PCI, CABG, Schrittmacher, ICD, CRT, HFrEF, HFpEF, Entresto, Myokarditis.',
  neurochirurgie:
    'Schädel-Hirn-Trauma, SHT, Subduralhämatom, Epiduralhämatom, Subarachnoidalblutung, SAB, Glioblastom, Astrozytom, Meningeom, Hypophysenadenom, Bandscheibenvorfall, Spinalkanalstenose, Spondylodese, Hemilaminektomie, Laminektomie, Kraniotomie, Trepanation, externe Ventrikeldrainage, EVD, VP-Shunt, Hydrozephalus, ICP-Monitoring, Hirntoddiagnostik.',
  neurologie:
    'Schlaganfall, Apoplex, TIA, NIHSS, Thrombolyse, rtPA, mechanische Thrombektomie, Multiple Sklerose, RRMS, PPMS, SPMS, Parkinson-Krankheit, Epilepsie, Status epilepticus, EEG, Meningitis, Enzephalitis, Liquorpunktion, Neuroborreliose, Guillain-Barré-Syndrom, Myasthenia gravis, ALS, EMG, NLG, VEP, SEP, Aphasie, Neglect.',
  nuklearmedizin:
    'Szintigraphie, Knochenszintigraphie, Schilddrüsenszintigraphie, Myokardszintigraphie, PET, PET-CT, PET-MRT, FDG, PSMA-PET, Gallium-68, Technetium-99m, Jod-131, Radiojodtherapie, Uptake, Radiosynoviorthese, MIBG-Szintigraphie, Somatostatinrezeptor-Szintigraphie, Sentinel-Lymphknoten-Szintigraphie, Tracer, Halbwertszeit, Dosimetrie.',
  orthopaedie_unfallchirurgie:
    'Gonarthrose, Koxarthrose, Rheumatoide Arthritis, Totalendoprothese, TEP, Knie-TEP, Hüft-TEP, Osteoporose, DXA-Messung, Fraktur, Schenkelhalsfraktur, distale Radiusfraktur, Wirbelkörperfraktur, Klavikulafraktur, Tibiaplateau-Fraktur, Rotatorenmanschette, Karpaltunnelsyndrom, Bandscheibenvorfall, Spinalkanalstenose, Meniskusläsion, VKB-Ruptur, Osteosynthese, Fixateur externe.',
  paediatrie:
    'U-Untersuchungen, Perzentile, APGAR-Score, Frühgeburtlichkeit, Ikterus neonatorum, RSV, Bronchiolitis, Pseudokrupp, Epiglottitis, Otitis media, Scharlach, Hand-Fuß-Mund-Krankheit, Masern, Mumps, Röteln, Varizellen, STIKO, febriler Krampfanfall, ADHS, Autismus-Spektrum-Störung, VSD, ASD, PDA, Mukoviszidose, Wilms-Tumor, Neuroblastom.',
  pneumologie:
    'Spirometrie, Lungenfunktion, FEV1, FVC, Tiffeneau-Index, Bodyplethysmographie, DLCO, COPD, GOLD-Stadien, Exazerbation, Asthma bronchiale, LABA, LAMA, ICS, Bronchoskopie, BAL, EBUS, Sarkoidose, EAA, IPF, Lungenembolie, Pleuraerguss, Pneumothorax, OSAS, CPAP, LOT, Bronchialkarzinom, NSCLC, Tuberkulose.',
  psychiatrie_psychotherapie:
    'Depression, Bipolare Störung, Manie, Schizophrenie, schizoaffektive Störung, Psychose, Negativsymptomatik, Positivsymptomatik, Borderline-Persönlichkeitsstörung, PTBS, Angststörung, Panikstörung, Zwangsstörung, OCD, Anorexia nervosa, Bulimia nervosa, ADHS, Delir, Alkoholentzug, Delirium tremens, SSRI, SNRI, Lithium, Quetiapin, Clozapin, Suizidalität, PsychKG.',
  psychosomatik_psychotherapie:
    'Somatoforme Störung, funktionelle Körperbeschwerden, somatische Belastungsstörung, Konversionsstörung, Fibromyalgie, Chronisches Fatigue-Syndrom, Long-Covid, Reizdarmsyndrom, funktionelle Dyspepsie, Burnout, Anpassungsstörung, Alexithymie, Krankheitsangst, biopsychosoziales Modell, KVT, psychodynamische Therapie, EMDR, Progressive Muskelentspannung, multimodale Schmerztherapie.',
  radiologie:
    'MRT, Magnetresonanztomographie, CT, Computertomographie, Röntgen, Durchleuchtung, Kontrastmittel, T1-Wichtung, T2-Wichtung, FLAIR, DWI, ADC-Map, Enhancement, Artefakt, Raumforderung, Infiltrat, Atelektase, Konsolidierung, Pleuraerguss, Pneumothorax, Knochenmarködem, Fraktur, Aneurysma, Embolie, CEUS, Doppler.',
  rechtsmedizin:
    'Obduktion, Sektion, Todesursache, Todesart, natürlicher Tod, nicht-natürlicher Tod, ungeklärter Todesfall, Leichenschau, Totenschein, Todeszeit, sichere Todeszeichen, Leichenstarre, Rigor mortis, Leichenflecke, Livores, Putrefaktion, Vitalitätszeichen, stumpfes Trauma, scharfes Trauma, Strangulation, Ertrinken, Intoxikation, BAK, forensische Toxikologie, DNA-Analyse.',
  rheumatologie:
    'Rheumatoide Arthritis, RA, Psoriasisarthritis, Morbus Bechterew, axiale Spondyloarthritis, Systemischer Lupus erythematodes, SLE, Sjögren-Syndrom, Sklerodermie, Polymyositis, Vaskulitis, Riesenzellarteriitis, Polymyalgia rheumatica, ANCA-assoziierte Vaskulitis, Gicht, Pseudogicht, HLA-B27, Rheumafaktor, Anti-CCP, ANA, ANCA, Methotrexat, MTX, Tocilizumab, JAK-Inhibitor.',
  urologie:
    'Prostatakarzinom, PSA, Gleason-Score, ISUP-Grad, radikale Prostatektomie, Nierenzellkarzinom, Harnblasenkarzinom, Urothelkarzinom, TUR-Blase, Zystoskopie, Nephrektomie, Harnleiterstein, Nephrolithiasis, Ureterolithiasis, ESWL, Ureterorenoskopie, URS, PCNL, Harnwegsinfekt, Pyelonephritis, Urosepsis, Uroflowmetrie, BPH, Hodentorsion, Hämaturie, DJ-Schiene.',
};

const SUBJECT_PROMPT_KEYS: Record<string, string> = {
  'allgemein- und viszeralchirurgie': 'allgemein_viszeralchirurgie',
  chirurgie: 'allgemein_viszeralchirurgie',
  allgemeinmedizin: 'allgemeinmedizin',
  'allgemeinmedizin (hausarzt)': 'allgemeinmedizin',
  'innere medizin (allgemein)': 'innere_medizin',
  'innere medizin': 'innere_medizin',
  'anästhesie, intensivmedizin, notfallmedizin & schmerztherapie': 'anaesthesie_intensiv_notfall_schmerz',
  anästhesiologie: 'anaesthesie_intensiv_notfall_schmerz',
  notfallmedizin: 'anaesthesie_intensiv_notfall_schmerz',
  angiologie: 'angiologie',
  dermatologie: 'dermatologie_venerologie',
  'dermatologie und venerologie': 'dermatologie_venerologie',
  diabetologie: 'diabetologie',
  'endokrinologie und stoffwechsel': 'endokrinologie_stoffwechsel',
  gastroenterologie: 'gastroenterologie',
  geriatrie: 'geriatrie',
  gefäßchirurgie: 'gefaesschirurgie',
  gefaesschirurgie: 'gefaesschirurgie',
  gynäkologie: 'gynaekologie_geburtshilfe',
  'gynäkologie und geburtshilfe': 'gynaekologie_geburtshilfe',
  'hämatologie und onkologie': 'haematologie_onkologie',
  infektiologie: 'infektiologie',
  kardiologie: 'kardiologie',
  neurochirurgie: 'neurochirurgie',
  neurologie: 'neurologie',
  nuklearmedizin: 'nuklearmedizin',
  'orthopädie und unfallchirurgie': 'orthopaedie_unfallchirurgie',
  pädiatrie: 'paediatrie',
  'kinder- und jugendmedizin (pädiatrie)': 'paediatrie',
  pneumologie: 'pneumologie',
  'psychiatrie und psychotherapie': 'psychiatrie_psychotherapie',
  'psychiatrie, psychosomatik und psychotherapie': 'psychiatrie_psychotherapie',
  psychosomatik: 'psychosomatik_psychotherapie',
  'psychosomatische medizin und psychotherapie': 'psychosomatik_psychotherapie',
  radiologie: 'radiologie',
  rechtsmedizin: 'rechtsmedizin',
  rheumatologie: 'rheumatologie',
  urologie: 'urologie',
};

function normalizeSubject(subject: string): string {
  return subject.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getWhisperPrompt(subject?: string): string {
  const key = subject ? SUBJECT_PROMPT_KEYS[normalizeSubject(subject)] : undefined;
  const specialtyPrompt = key ? MEDICAL_PROMPTS[key] : MEDICAL_PROMPTS.allgemeinmedizin;
  return `${COMMON_MEDICAL_PROMPT} Fachbezogene Begriffe: ${specialtyPrompt}`;
}
