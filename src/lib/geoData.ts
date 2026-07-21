// Country → governorate/state → city cascade data.
// Countries not listed here fall back to free-text input in the UI.

export type GeoCity = { ar: string; en: string };
export type GeoState = { ar: string; en: string; cities: GeoCity[] };
export type GeoCountry = Record<string, GeoState>;

// Egypt — all 27 governorates. Cities/marakez cover the official
// administrative units per governorate (compiled from CAPMAS listings);
// large governorates include their main new cities as well.
const EG: GeoCountry = {
  CAI: { ar: "القاهرة", en: "Cairo", cities: [
    { ar: "القاهرة", en: "Cairo" }, { ar: "وسط البلد", en: "Downtown" },
    { ar: "الزمالك", en: "Zamalek" }, { ar: "جاردن سيتي", en: "Garden City" },
    { ar: "مصر الجديدة", en: "Heliopolis" }, { ar: "مدينة نصر", en: "Nasr City" },
    { ar: "المعادي", en: "Maadi" }, { ar: "المقطم", en: "Al Mokattam" },
    { ar: "التجمع الأول", en: "First Settlement" }, { ar: "التجمع الخامس", en: "Fifth Settlement" },
    { ar: "الرحاب", en: "Al Rehab" }, { ar: "مدينتي", en: "Madinaty" },
    { ar: "العاصمة الإدارية", en: "New Administrative Capital" },
    { ar: "الشروق", en: "El Shorouk" }, { ar: "بدر", en: "Badr" },
    { ar: "15 مايو", en: "15th of May" }, { ar: "حلوان", en: "Helwan" },
    { ar: "المرج", en: "El Marg" }, { ar: "المطرية", en: "El Matareya" },
    { ar: "الزيتون", en: "El Zeitoun" }, { ar: "شبرا", en: "Shubra" },
    { ar: "روض الفرج", en: "Rod El Farag" }, { ar: "بولاق", en: "Boulaq" },
    { ar: "عابدين", en: "Abdeen" }, { ar: "السيدة زينب", en: "Sayeda Zeinab" },
    { ar: "مصر القديمة", en: "Old Cairo" }, { ar: "دار السلام", en: "Dar El Salam" },
    { ar: "البساتين", en: "El Basateen" }, { ar: "المنيل", en: "El Manial" },
    { ar: "عين شمس", en: "Ain Shams" }, { ar: "حدائق القبة", en: "Hadayek El Qobba" },
    { ar: "الوايلي", en: "El Waili" }, { ar: "الأزبكية", en: "El Azbakeya" },
    { ar: "الجمالية", en: "El Gamaliya" }, { ar: "الدرب الأحمر", en: "El Darb El Ahmar" },
    { ar: "الخليفة", en: "El Khalifa" }, { ar: "المقس", en: "El Moqattam" },
    { ar: "التبين", en: "El Tebbin" }, { ar: "مسطرد", en: "Mostorod" },
  ]},
  GIZ: { ar: "الجيزة", en: "Giza", cities: [
    { ar: "الجيزة", en: "Giza" }, { ar: "الدقي", en: "Dokki" },
    { ar: "المهندسين", en: "Mohandessin" }, { ar: "العجوزة", en: "Agouza" },
    { ar: "بولاق الدكرور", en: "Boulaq El Dakrour" }, { ar: "الوراق", en: "El Warraq" },
    { ar: "إمبابة", en: "Imbaba" }, { ar: "الهرم", en: "Haram" },
    { ar: "فيصل", en: "Faisal" }, { ar: "الطالبية", en: "El Talbeya" },
    { ar: "أوسيم", en: "Ossim" }, { ar: "كرداسة", en: "Kerdasa" },
    { ar: "أبو النمرس", en: "Abu El Nomros" }, { ar: "البدرشين", en: "Al Badrashin" },
    { ar: "العياط", en: "El Ayat" }, { ar: "الصف", en: "Al Saff" },
    { ar: "أطفيح", en: "Atfih" }, { ar: "6 أكتوبر", en: "6th of October" },
    { ar: "الشيخ زايد", en: "Sheikh Zayed" }, { ar: "حدائق أكتوبر", en: "October Gardens" },
    { ar: "الحوامدية", en: "El Hawamdeya" }, { ar: "منشأة القناطر", en: "Manshiyat El Qanater" },
    { ar: "البواطي", en: "El Bawaty" }, { ar: "ساقية مكي", en: "Saqiyat Makki" },
  ]},
  ALX: { ar: "الإسكندرية", en: "Alexandria", cities: [
    { ar: "الإسكندرية", en: "Alexandria" }, { ar: "المنتزه", en: "Al Montaza" },
    { ar: "شرق", en: "East" }, { ar: "وسط", en: "Central" },
    { ar: "غرب", en: "West" }, { ar: "الجمرك", en: "El Gomrok" },
    { ar: "العامرية", en: "Al Ameriya" }, { ar: "برج العرب", en: "Borg El Arab" },
    { ar: "برج العرب الجديدة", en: "New Borg El Arab" }, { ar: "العجمي", en: "Agami" },
    { ar: "الدخيلة", en: "El Dekheila" }, { ar: "سيدي بشر", en: "Sidi Bishr" },
    { ar: "سيدي جابر", en: "Sidi Gaber" }, { ar: "سموحة", en: "Smouha" },
    { ar: "محرم بك", en: "Moharram Bek" }, { ar: "كامب شيزار", en: "Camp Chezar" },
    { ar: "المعمورة", en: "El Mamoura" }, { ar: "أبو قير", en: "Abu Qir" },
    { ar: "المكس", en: "El Max" }, { ar: "الحضرة", en: "El Hadara" },
    { ar: "العصافرة", en: "El Asafra" }, { ar: "المنشية", en: "El Manshiya" },
  ]},
  DKH: { ar: "الدقهلية", en: "Dakahlia", cities: [
    { ar: "المنصورة", en: "Mansoura" }, { ar: "طلخا", en: "Talkha" },
    { ar: "ميت غمر", en: "Mit Ghamr" }, { ar: "دكرنس", en: "Dekernes" },
    { ar: "أجا", en: "Aga" }, { ar: "المنزلة", en: "El Manzala" },
    { ar: "بلقاس", en: "Belqas" }, { ar: "شربين", en: "Sherbin" },
    { ar: "المطرية", en: "El Matareya" }, { ar: "بني عبيد", en: "Beni Ebeid" },
    { ar: "منية النصر", en: "Menyet El Nasr" }, { ar: "السنبلاوين", en: "El Senbellawein" },
    { ar: "الجمالية", en: "El Gamaliya" }, { ar: "محلة دمنة", en: "Mahallet Damana" },
    { ar: "نبروه", en: "Nabaroh" }, { ar: "تمي الأمديد", en: "Tami El Amdid" },
    { ar: "المنصورة الجديدة", en: "New Mansoura" },
  ]},
  SHR: { ar: "الشرقية", en: "Sharqia", cities: [
    { ar: "الزقازيق", en: "Zagazig" }, { ar: "العاشر من رمضان", en: "10th of Ramadan" },
    { ar: "منيا القمح", en: "Minya Al Qamh" }, { ar: "بلبيس", en: "Bilbeis" },
    { ar: "مشتول السوق", en: "Mashtool El Souq" }, { ar: "القنايات", en: "El Qenayat" },
    { ar: "أبو حماد", en: "Abu Hammad" }, { ar: "القرين", en: "El Qurein" },
    { ar: "ههيا", en: "Hehia" }, { ar: "أبو كبير", en: "Abu Kebir" },
    { ar: "فاقوس", en: "Faqous" }, { ar: "الصالحية الجديدة", en: "El Salhiya El Gedida" },
    { ar: "الإبراهيمية", en: "El Ibrahimeya" }, { ar: "ديرب نجم", en: "Dyarb Negm" },
    { ar: "كفر صقر", en: "Kafr Saqr" }, { ar: "أولاد صقر", en: "Awlad Saqr" },
    { ar: "الحسينية", en: "El Husseinia" }, { ar: "صان الحجر", en: "San El Hagar" },
    { ar: "منشأة أبو عمر", en: "Manshaat Abu Omar" },
  ]},
  GHR: { ar: "الغربية", en: "Gharbia", cities: [
    { ar: "طنطا", en: "Tanta" }, { ar: "المحلة الكبرى", en: "Mahalla Al Kubra" },
    { ar: "كفر الزيات", en: "Kafr El Zayat" }, { ar: "زفتى", en: "Zefta" },
    { ar: "السنطة", en: "El Santa" }, { ar: "قطور", en: "Qutur" },
    { ar: "بسيون", en: "Basyoun" }, { ar: "سمنود", en: "Samannoud" },
  ]},
  MNF: { ar: "المنوفية", en: "Monufia", cities: [
    { ar: "شبين الكوم", en: "Shibin El Kom" }, { ar: "منوف", en: "Menouf" },
    { ar: "سرس الليان", en: "Sers El Layan" }, { ar: "أشمون", en: "Ashmoun" },
    { ar: "الباجور", en: "El Bagour" }, { ar: "قويسنا", en: "Quesna" },
    { ar: "بركة السبع", en: "Berket El Sabaa" }, { ar: "تلا", en: "Tala" },
    { ar: "الشهداء", en: "El Shohada" }, { ar: "السادات", en: "Sadat City" },
  ]},
  QLY: { ar: "القليوبية", en: "Qalyubia", cities: [
    { ar: "بنها", en: "Benha" }, { ar: "قليوب", en: "Qalyub" },
    { ar: "شبرا الخيمة", en: "Shubra El Kheima" }, { ar: "القناطر الخيرية", en: "Qanater El Khairiya" },
    { ar: "الخانكة", en: "Khanka" }, { ar: "كفر شكر", en: "Kafr Shukr" },
    { ar: "طوخ", en: "Toukh" }, { ar: "قها", en: "Qaha" },
    { ar: "العبور", en: "El Obour" }, { ar: "الخصوص", en: "El Khosous" },
    { ar: "شبين القناطر", en: "Shibin El Qanater" }, { ar: "المنيرة", en: "El Muneira" },
    { ar: "القلج", en: "El Qalag" },
  ]},
  KFS: { ar: "كفر الشيخ", en: "Kafr El Sheikh", cities: [
    { ar: "كفر الشيخ", en: "Kafr El Sheikh" }, { ar: "دسوق", en: "Desouk" },
    { ar: "فوه", en: "Fuwah" }, { ar: "مطوبس", en: "Metoubes" },
    { ar: "برج البرلس", en: "Borg El Borollos" }, { ar: "بلطيم", en: "Baltim" },
    { ar: "الحامول", en: "El Hamool" }, { ar: "بيلا", en: "Beila" },
    { ar: "الرياض", en: "El Riyad" }, { ar: "سيدي سالم", en: "Sidi Salem" },
    { ar: "قلين", en: "Qellin" }, { ar: "الشيخ زويد", en: "Sheikh Zuweid" },
  ]},
  BHR: { ar: "البحيرة", en: "Beheira", cities: [
    { ar: "دمنهور", en: "Damanhour" }, { ar: "كفر الدوار", en: "Kafr El Dawwar" },
    { ar: "رشيد", en: "Rosetta" }, { ar: "إدكو", en: "Edku" },
    { ar: "أبو حمص", en: "Abu Hummus" }, { ar: "الدلنجات", en: "El Delengat" },
    { ar: "المحمودية", en: "El Mahmoudiya" }, { ar: "الرحمانية", en: "Rahmaniya" },
    { ar: "إيتاي البارود", en: "Itay El Baroud" }, { ar: "حوش عيسى", en: "Housh Eissa" },
    { ar: "شبراخيت", en: "Shubrakhit" }, { ar: "كوم حمادة", en: "Kom Hamada" },
    { ar: "بدر", en: "Badr" }, { ar: "وادي النطرون", en: "Wadi El Natrun" },
    { ar: "النوبارية الجديدة", en: "New Nubaria" }, { ar: "أبو المطامير", en: "Abu El Matamir" },
  ]},
  ISM: { ar: "الإسماعيلية", en: "Ismailia", cities: [
    { ar: "الإسماعيلية", en: "Ismailia" }, { ar: "فايد", en: "Fayed" },
    { ar: "القنطرة شرق", en: "Qantara East" }, { ar: "القنطرة غرب", en: "Qantara West" },
    { ar: "التل الكبير", en: "Tell El Kebir" }, { ar: "أبو صوير", en: "Abu Suwir" },
    { ar: "القصاصين الجديدة", en: "New Qassasin" }, { ar: "نفيشة", en: "Nefisha" },
    { ar: "الشيخ زايد", en: "Sheikh Zayed" },
  ]},
  SUZ: { ar: "السويس", en: "Suez", cities: [
    { ar: "السويس", en: "Suez" }, { ar: "عتاقة", en: "Ataqa" },
    { ar: "الأربعين", en: "Al Arbaeen" }, { ar: "الجناين", en: "Ganayen" },
    { ar: "فيصل", en: "Faisal" }, { ar: "عين السخنة", en: "Ain Sokhna" },
  ]},
  PTS: { ar: "بورسعيد", en: "Port Said", cities: [
    { ar: "بورسعيد", en: "Port Said" }, { ar: "بورفؤاد", en: "Port Fouad" },
    { ar: "الزهور", en: "Al Zohour" }, { ar: "المناخ", en: "Al Manakh" },
    { ar: "الشرق", en: "El Sharq" }, { ar: "العرب", en: "El Arab" },
    { ar: "الضواحي", en: "El Dawahi" }, { ar: "الجنوب", en: "El Ganoub" },
  ]},
  DMT: { ar: "دمياط", en: "Damietta", cities: [
    { ar: "دمياط", en: "Damietta" }, { ar: "دمياط الجديدة", en: "New Damietta" },
    { ar: "رأس البر", en: "Ras El Bar" }, { ar: "فارسكور", en: "Faraskur" },
    { ar: "كفر سعد", en: "Kafr Saad" }, { ar: "الزرقا", en: "Zarqa" },
    { ar: "الروضة", en: "El Rawda" }, { ar: "كفر البطيخ", en: "Kafr El Batteekh" },
    { ar: "السرو", en: "El Sarw" }, { ar: "ميت أبو غالب", en: "Meet Abu Ghaleb" },
  ]},
  FYM: { ar: "الفيوم", en: "Fayoum", cities: [
    { ar: "الفيوم", en: "Fayoum" }, { ar: "الفيوم الجديدة", en: "New Fayoum" },
    { ar: "طامية", en: "Tamiya" }, { ar: "سنورس", en: "Sinnuris" },
    { ar: "إطسا", en: "Etsa" }, { ar: "إبشواي", en: "Ibsheway" },
    { ar: "يوسف الصديق", en: "Youssef El Seddik" },
  ]},
  BNS: { ar: "بني سويف", en: "Beni Suef", cities: [
    { ar: "بني سويف", en: "Beni Suef" }, { ar: "بني سويف الجديدة", en: "New Beni Suef" },
    { ar: "الواسطى", en: "Wasta" }, { ar: "ناصر", en: "Nasser" },
    { ar: "إهناسيا", en: "Ihnasia" }, { ar: "ببا", en: "Beba" },
    { ar: "سمسطا", en: "Sumusta" }, { ar: "الفشن", en: "Fashn" },
  ]},
  MNY: { ar: "المنيا", en: "Minya", cities: [
    { ar: "المنيا", en: "Minya" }, { ar: "المنيا الجديدة", en: "New Minya" },
    { ar: "العدوة", en: "El Adwa" }, { ar: "مغاغة", en: "Maghagha" },
    { ar: "بني مزار", en: "Beni Mazar" }, { ar: "مطاي", en: "Matay" },
    { ar: "سمالوط", en: "Samalut" }, { ar: "المدينة الفكرية", en: "El Fikreya" },
    { ar: "أبو قرقاص", en: "Abu Qurqas" }, { ar: "ملوي", en: "Mallawi" },
    { ar: "ديرمواس", en: "Deir Mawas" },
  ]},
  AST: { ar: "أسيوط", en: "Assiut", cities: [
    { ar: "أسيوط", en: "Assiut" }, { ar: "أسيوط الجديدة", en: "New Assiut" },
    { ar: "ديروط", en: "Dairut" }, { ar: "منفلوط", en: "Manfalut" },
    { ar: "القوصية", en: "Qusiya" }, { ar: "أبنوب", en: "Abnub" },
    { ar: "أبو تيج", en: "Abu Tig" }, { ar: "الغنايم", en: "El Ghanayem" },
    { ar: "ساحل سليم", en: "Sahel Selim" }, { ar: "البداري", en: "El Badari" },
    { ar: "صدفا", en: "Sedfa" },
  ]},
  SHG: { ar: "سوهاج", en: "Sohag", cities: [
    { ar: "سوهاج", en: "Sohag" }, { ar: "سوهاج الجديدة", en: "New Sohag" },
    { ar: "أخميم", en: "Akhmim" }, { ar: "أخميم الجديدة", en: "New Akhmim" },
    { ar: "البلينا", en: "Balyana" }, { ar: "جهينة الغربية", en: "Gohaina" },
    { ar: "جرجا", en: "Girga" }, { ar: "المراغة", en: "Al Maragha" },
    { ar: "المنشاة", en: "El Menshah" }, { ar: "دار السلام", en: "Dar El Salam" },
    { ar: "طما", en: "Tama" }, { ar: "طهطا", en: "Tahta" },
    { ar: "ساقلتة", en: "Saqultah" },
  ]},
  QNA: { ar: "قنا", en: "Qena", cities: [
    { ar: "قنا", en: "Qena" }, { ar: "قنا الجديدة", en: "New Qena" },
    { ar: "أبو تشت", en: "Abu Tesht" }, { ar: "نجع حمادي", en: "Nag Hammadi" },
    { ar: "دشنا", en: "Deshna" }, { ar: "الوقف", en: "El Waqf" },
    { ar: "قفط", en: "Qift" }, { ar: "نقادة", en: "Naqada" },
    { ar: "فرشوط", en: "Farshout" }, { ar: "قوص", en: "Qus" },
  ]},
  LXR: { ar: "الأقصر", en: "Luxor", cities: [
    { ar: "الأقصر", en: "Luxor" }, { ar: "الأقصر الجديدة", en: "New Luxor" },
    { ar: "الطود", en: "Tod" }, { ar: "إسنا", en: "Esna" },
    { ar: "أرمنت", en: "Armant" }, { ar: "البياضية", en: "Bayadeya" },
    { ar: "الزينية", en: "El Zeiniya" }, { ar: "القرنة", en: "El Qurna" },
  ]},
  ASN: { ar: "أسوان", en: "Aswan", cities: [
    { ar: "أسوان", en: "Aswan" }, { ar: "أسوان الجديدة", en: "New Aswan" },
    { ar: "دراو", en: "Draw" }, { ar: "كوم أمبو", en: "Kom Ombo" },
    { ar: "نصر النوبة", en: "Nasr El Nuba" }, { ar: "كلابشة", en: "Kalabsha" },
    { ar: "إدفو", en: "Edfu" }, { ar: "الرديسية", en: "El Radeisiya" },
    { ar: "البصيلية", en: "El Basiliya" }, { ar: "السباعية", en: "El Sebaeya" },
    { ar: "أبو سمبل", en: "Abu Simbel" },
  ]},
  BAH: { ar: "البحر الأحمر", en: "Red Sea", cities: [
    { ar: "الغردقة", en: "Hurghada" }, { ar: "رأس غارب", en: "Ras Gharib" },
    { ar: "سفاجا", en: "Safaga" }, { ar: "القصير", en: "Qusair" },
    { ar: "مرسى علم", en: "Marsa Alam" }, { ar: "الشلاتين", en: "Shalateen" },
    { ar: "حلايب", en: "Halayeb" }, { ar: "الجونة", en: "El Gouna" },
    { ar: "سهل حشيش", en: "Sahl Hasheesh" },
  ]},
  WDG: { ar: "الوادي الجديد", en: "New Valley", cities: [
    { ar: "الخارجة", en: "Kharga" }, { ar: "الداخلة", en: "Dakhla" },
    { ar: "الفرافرة", en: "Farafra" }, { ar: "باريس", en: "Paris" },
    { ar: "بلاط", en: "Balat" }, { ar: "موط", en: "Mut" },
  ]},
  MTR: { ar: "مطروح", en: "Matrouh", cities: [
    { ar: "مرسى مطروح", en: "Marsa Matrouh" }, { ar: "العلمين", en: "El Alamein" },
    { ar: "العلمين الجديدة", en: "New Alamein" }, { ar: "الضبعة", en: "Dabaa" },
    { ar: "النجيلة", en: "El Negeila" }, { ar: "سيدي براني", en: "Sidi Barrani" },
    { ar: "السلوم", en: "Sallum" }, { ar: "سيوة", en: "Siwa" },
    { ar: "الحمام", en: "El Hammam" }, { ar: "براني", en: "Barrani" },
  ]},
  SIN: { ar: "شمال سيناء", en: "North Sinai", cities: [
    { ar: "العريش", en: "Arish" }, { ar: "الشيخ زويد", en: "Sheikh Zuweid" },
    { ar: "رفح", en: "Rafah" }, { ar: "بئر العبد", en: "Bir Al Abd" },
    { ar: "نخل", en: "Nakhl" }, { ar: "الحسنة", en: "El Hasana" },
  ]},
  SSN: { ar: "جنوب سيناء", en: "South Sinai", cities: [
    { ar: "الطور", en: "El Tor" }, { ar: "شرم الشيخ", en: "Sharm El Sheikh" },
    { ar: "دهب", en: "Dahab" }, { ar: "نويبع", en: "Nuweiba" },
    { ar: "طابا", en: "Taba" }, { ar: "سانت كاترين", en: "Saint Catherine" },
    { ar: "أبو رديس", en: "Abu Rudeis" }, { ar: "أبو زنيمة", en: "Abu Zenima" },
    { ar: "رأس سدر", en: "Ras Sedr" },
  ]},
};

// Saudi Arabia — 13 regions with main cities.
const SA: GeoCountry = {
  RUH: { ar: "الرياض", en: "Riyadh", cities: [
    { ar: "الرياض", en: "Riyadh" }, { ar: "الخرج", en: "Al Kharj" },
    { ar: "الدوادمي", en: "Dawadmi" }, { ar: "المجمعة", en: "Majmaah" },
  ]},
  MKA: { ar: "مكة المكرمة", en: "Makkah", cities: [
    { ar: "مكة", en: "Makkah" }, { ar: "جدة", en: "Jeddah" },
    { ar: "الطائف", en: "Taif" }, { ar: "رابغ", en: "Rabigh" },
  ]},
  MED: { ar: "المدينة المنورة", en: "Madinah", cities: [
    { ar: "المدينة المنورة", en: "Madinah" }, { ar: "ينبع", en: "Yanbu" },
    { ar: "العلا", en: "AlUla" }, { ar: "بدر", en: "Badr" },
  ]},
  EAS: { ar: "الشرقية", en: "Eastern Province", cities: [
    { ar: "الدمام", en: "Dammam" }, { ar: "الخبر", en: "Khobar" },
    { ar: "الظهران", en: "Dhahran" }, { ar: "الأحساء", en: "Al Ahsa" },
    { ar: "الجبيل", en: "Jubail" }, { ar: "القطيف", en: "Qatif" },
  ]},
  ASR: { ar: "عسير", en: "Asir", cities: [
    { ar: "أبها", en: "Abha" }, { ar: "خميس مشيط", en: "Khamis Mushait" },
  ]},
  TAB: { ar: "تبوك", en: "Tabuk", cities: [{ ar: "تبوك", en: "Tabuk" }, { ar: "نيوم", en: "NEOM" }]},
  QSM: { ar: "القصيم", en: "Qassim", cities: [{ ar: "بريدة", en: "Buraydah" }, { ar: "عنيزة", en: "Unaizah" }]},
  HIL: { ar: "حائل", en: "Hail", cities: [{ ar: "حائل", en: "Hail" }]},
  NRB: { ar: "الحدود الشمالية", en: "Northern Borders", cities: [{ ar: "عرعر", en: "Arar" }]},
  JZN: { ar: "جازان", en: "Jazan", cities: [{ ar: "جازان", en: "Jazan" }, { ar: "صبيا", en: "Sabya" }]},
  NJR: { ar: "نجران", en: "Najran", cities: [{ ar: "نجران", en: "Najran" }]},
  BAH2: { ar: "الباحة", en: "Al Bahah", cities: [{ ar: "الباحة", en: "Al Bahah" }]},
  JOF: { ar: "الجوف", en: "Al Jouf", cities: [{ ar: "سكاكا", en: "Sakaka" }, { ar: "دومة الجندل", en: "Dumat Al Jandal" }]},
};

// UAE — 7 emirates.
const AE: GeoCountry = {
  AUH: { ar: "أبوظبي", en: "Abu Dhabi", cities: [
    { ar: "أبوظبي", en: "Abu Dhabi" }, { ar: "العين", en: "Al Ain" }, { ar: "الظفرة", en: "Al Dhafra" },
  ]},
  DXB: { ar: "دبي", en: "Dubai", cities: [
    { ar: "دبي", en: "Dubai" }, { ar: "حتا", en: "Hatta" },
  ]},
  SHJ: { ar: "الشارقة", en: "Sharjah", cities: [
    { ar: "الشارقة", en: "Sharjah" }, { ar: "خورفكان", en: "Khor Fakkan" }, { ar: "كلباء", en: "Kalba" },
  ]},
  AJM: { ar: "عجمان", en: "Ajman", cities: [{ ar: "عجمان", en: "Ajman" }]},
  UAQ: { ar: "أم القيوين", en: "Umm Al Quwain", cities: [{ ar: "أم القيوين", en: "Umm Al Quwain" }]},
  RAK: { ar: "رأس الخيمة", en: "Ras Al Khaimah", cities: [{ ar: "رأس الخيمة", en: "Ras Al Khaimah" }]},
  FUJ: { ar: "الفجيرة", en: "Fujairah", cities: [{ ar: "الفجيرة", en: "Fujairah" }, { ar: "دبا", en: "Dibba" }]},
};

export const GEO: Record<string, GeoCountry> = { EG, SA, AE };

export function hasGeo(country: string | null | undefined): boolean {
  return !!country && !!GEO[country];
}

export function getStates(country: string | null | undefined): Array<{ key: string; ar: string; en: string }> {
  const c = country && GEO[country];
  if (!c) return [];
  return Object.entries(c).map(([key, v]) => ({ key, ar: v.ar, en: v.en }));
}

export function getCities(country: string | null | undefined, stateKey: string | null | undefined): GeoCity[] {
  if (!country || !stateKey) return [];
  return GEO[country]?.[stateKey]?.cities ?? [];
}

// Look up a stored state value (which may be a key OR a raw name from earlier drafts)
// and return the canonical key if we can match it.
export function resolveStateKey(country: string | null | undefined, value: string | null | undefined): string | null {
  if (!country || !value) return null;
  const c = GEO[country];
  if (!c) return null;
  if (c[value]) return value;
  const v = value.trim();
  for (const [key, st] of Object.entries(c)) {
    if (st.ar === v || st.en.toLowerCase() === v.toLowerCase()) return key;
  }
  return null;
}
