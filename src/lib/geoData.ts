// Country → governorate/state → city cascade data.
// Countries not listed here fall back to free-text input in the UI.

export type GeoCity = { ar: string; en: string };
export type GeoState = { ar: string; en: string; cities: GeoCity[] };
export type GeoCountry = Record<string, GeoState>;

// Egypt — all 27 governorates with the main cities/marakez in each.
const EG: GeoCountry = {
  CAI: { ar: "القاهرة", en: "Cairo", cities: [
    { ar: "القاهرة", en: "Cairo" }, { ar: "مدينة نصر", en: "Nasr City" },
    { ar: "مصر الجديدة", en: "Heliopolis" }, { ar: "المعادي", en: "Maadi" },
    { ar: "التجمع الخامس", en: "Fifth Settlement" }, { ar: "حلوان", en: "Helwan" },
    { ar: "الشروق", en: "El Shorouk" }, { ar: "بدر", en: "Badr" },
  ]},
  GIZ: { ar: "الجيزة", en: "Giza", cities: [
    { ar: "الجيزة", en: "Giza" }, { ar: "6 أكتوبر", en: "6th of October" },
    { ar: "الشيخ زايد", en: "Sheikh Zayed" }, { ar: "الهرم", en: "Haram" },
    { ar: "فيصل", en: "Faisal" }, { ar: "إمبابة", en: "Imbaba" },
    { ar: "البدرشين", en: "Al Badrashin" }, { ar: "أوسيم", en: "Ossim" },
  ]},
  ALX: { ar: "الإسكندرية", en: "Alexandria", cities: [
    { ar: "الإسكندرية", en: "Alexandria" }, { ar: "برج العرب", en: "Borg El Arab" },
    { ar: "العامرية", en: "Al Ameriya" }, { ar: "المنتزه", en: "Al Montaza" },
    { ar: "سيدي جابر", en: "Sidi Gaber" }, { ar: "العجمي", en: "Agami" },
  ]},
  DKH: { ar: "الدقهلية", en: "Dakahlia", cities: [
    { ar: "المنصورة", en: "Mansoura" }, { ar: "طلخا", en: "Talkha" },
    { ar: "ميت غمر", en: "Mit Ghamr" }, { ar: "دكرنس", en: "Dekernes" },
    { ar: "بلقاس", en: "Belqas" }, { ar: "أجا", en: "Aga" },
  ]},
  SHR: { ar: "الشرقية", en: "Sharqia", cities: [
    { ar: "الزقازيق", en: "Zagazig" }, { ar: "العاشر من رمضان", en: "10th of Ramadan" },
    { ar: "بلبيس", en: "Bilbeis" }, { ar: "منيا القمح", en: "Minya Al Qamh" },
    { ar: "فاقوس", en: "Faqous" }, { ar: "أبو حماد", en: "Abu Hammad" },
  ]},
  GHR: { ar: "الغربية", en: "Gharbia", cities: [
    { ar: "طنطا", en: "Tanta" }, { ar: "المحلة الكبرى", en: "Mahalla Al Kubra" },
    { ar: "كفر الزيات", en: "Kafr El Zayat" }, { ar: "زفتى", en: "Zefta" },
    { ar: "السنطة", en: "El Santa" }, { ar: "سمنود", en: "Samannoud" },
  ]},
  MNF: { ar: "المنوفية", en: "Monufia", cities: [
    { ar: "شبين الكوم", en: "Shibin El Kom" }, { ar: "منوف", en: "Menouf" },
    { ar: "أشمون", en: "Ashmoun" }, { ar: "السادات", en: "Sadat City" },
    { ar: "بركة السبع", en: "Berket El Sabaa" }, { ar: "قويسنا", en: "Quesna" },
  ]},
  QLY: { ar: "القليوبية", en: "Qalyubia", cities: [
    { ar: "بنها", en: "Benha" }, { ar: "شبرا الخيمة", en: "Shubra El Kheima" },
    { ar: "القناطر الخيرية", en: "Qanater El Khairiya" }, { ar: "قليوب", en: "Qalyub" },
    { ar: "الخانكة", en: "Khanka" }, { ar: "طوخ", en: "Toukh" },
  ]},
  KFS: { ar: "كفر الشيخ", en: "Kafr El Sheikh", cities: [
    { ar: "كفر الشيخ", en: "Kafr El Sheikh" }, { ar: "دسوق", en: "Desouk" },
    { ar: "بلطيم", en: "Baltim" }, { ar: "فوه", en: "Fuwah" },
    { ar: "سيدي سالم", en: "Sidi Salem" },
  ]},
  BHR: { ar: "البحيرة", en: "Beheira", cities: [
    { ar: "دمنهور", en: "Damanhour" }, { ar: "كفر الدوار", en: "Kafr El Dawwar" },
    { ar: "رشيد", en: "Rosetta" }, { ar: "إدكو", en: "Edku" },
    { ar: "أبو المطامير", en: "Abu El Matamir" }, { ar: "الرحمانية", en: "Rahmaniya" },
  ]},
  ISM: { ar: "الإسماعيلية", en: "Ismailia", cities: [
    { ar: "الإسماعيلية", en: "Ismailia" }, { ar: "فايد", en: "Fayed" },
    { ar: "القنطرة شرق", en: "Qantara East" }, { ar: "القنطرة غرب", en: "Qantara West" },
    { ar: "التل الكبير", en: "Tell El Kebir" },
  ]},
  SUZ: { ar: "السويس", en: "Suez", cities: [
    { ar: "السويس", en: "Suez" }, { ar: "عتاقة", en: "Ataqa" },
    { ar: "الأربعين", en: "Al Arbaeen" }, { ar: "الجناين", en: "Ganayen" },
  ]},
  PTS: { ar: "بورسعيد", en: "Port Said", cities: [
    { ar: "بورسعيد", en: "Port Said" }, { ar: "بورفؤاد", en: "Port Fouad" },
    { ar: "الزهور", en: "Al Zohour" }, { ar: "المناخ", en: "Al Manakh" },
  ]},
  DMT: { ar: "دمياط", en: "Damietta", cities: [
    { ar: "دمياط", en: "Damietta" }, { ar: "رأس البر", en: "Ras El Bar" },
    { ar: "فارسكور", en: "Faraskur" }, { ar: "كفر سعد", en: "Kafr Saad" },
    { ar: "الزرقا", en: "Zarqa" },
  ]},
  FYM: { ar: "الفيوم", en: "Fayoum", cities: [
    { ar: "الفيوم", en: "Fayoum" }, { ar: "طامية", en: "Tamiya" },
    { ar: "سنورس", en: "Sinnuris" }, { ar: "إطسا", en: "Etsa" },
    { ar: "يوسف الصديق", en: "Youssef El Seddik" },
  ]},
  BNS: { ar: "بني سويف", en: "Beni Suef", cities: [
    { ar: "بني سويف", en: "Beni Suef" }, { ar: "الواسطى", en: "Wasta" },
    { ar: "ناصر", en: "Nasser" }, { ar: "إهناسيا", en: "Ihnasia" },
    { ar: "ببا", en: "Beba" }, { ar: "الفشن", en: "Fashn" },
  ]},
  MNY: { ar: "المنيا", en: "Minya", cities: [
    { ar: "المنيا", en: "Minya" }, { ar: "ملوي", en: "Mallawi" },
    { ar: "بني مزار", en: "Beni Mazar" }, { ar: "مطاي", en: "Matay" },
    { ar: "سمالوط", en: "Samalut" }, { ar: "أبو قرقاص", en: "Abu Qurqas" },
  ]},
  AST: { ar: "أسيوط", en: "Assiut", cities: [
    { ar: "أسيوط", en: "Assiut" }, { ar: "ديروط", en: "Dairut" },
    { ar: "منفلوط", en: "Manfalut" }, { ar: "القوصية", en: "Qusiya" },
    { ar: "أبنوب", en: "Abnub" }, { ar: "أبو تيج", en: "Abu Tig" },
  ]},
  SHG: { ar: "سوهاج", en: "Sohag", cities: [
    { ar: "سوهاج", en: "Sohag" }, { ar: "أخميم", en: "Akhmim" },
    { ar: "طهطا", en: "Tahta" }, { ar: "جرجا", en: "Girga" },
    { ar: "البلينا", en: "Balyana" }, { ar: "المراغة", en: "Al Maragha" },
  ]},
  QNA: { ar: "قنا", en: "Qena", cities: [
    { ar: "قنا", en: "Qena" }, { ar: "نجع حمادي", en: "Nag Hammadi" },
    { ar: "دشنا", en: "Deshna" }, { ar: "قوص", en: "Qus" },
    { ar: "أبو تشت", en: "Abu Tesht" }, { ar: "قفط", en: "Qift" },
  ]},
  LXR: { ar: "الأقصر", en: "Luxor", cities: [
    { ar: "الأقصر", en: "Luxor" }, { ar: "الطود", en: "Tod" },
    { ar: "إسنا", en: "Esna" }, { ar: "أرمنت", en: "Armant" },
    { ar: "البياضية", en: "Bayadeya" },
  ]},
  ASN: { ar: "أسوان", en: "Aswan", cities: [
    { ar: "أسوان", en: "Aswan" }, { ar: "كوم أمبو", en: "Kom Ombo" },
    { ar: "دراو", en: "Draw" }, { ar: "إدفو", en: "Edfu" },
    { ar: "أبو سمبل", en: "Abu Simbel" },
  ]},
  BAH: { ar: "البحر الأحمر", en: "Red Sea", cities: [
    { ar: "الغردقة", en: "Hurghada" }, { ar: "سفاجا", en: "Safaga" },
    { ar: "القصير", en: "Qusair" }, { ar: "مرسى علم", en: "Marsa Alam" },
    { ar: "رأس غارب", en: "Ras Gharib" }, { ar: "الشلاتين", en: "Shalateen" },
  ]},
  WDG: { ar: "الوادي الجديد", en: "New Valley", cities: [
    { ar: "الخارجة", en: "Kharga" }, { ar: "الداخلة", en: "Dakhla" },
    { ar: "الفرافرة", en: "Farafra" }, { ar: "باريس", en: "Paris" },
    { ar: "بلاط", en: "Balat" },
  ]},
  MTR: { ar: "مطروح", en: "Matrouh", cities: [
    { ar: "مرسى مطروح", en: "Marsa Matrouh" }, { ar: "العلمين", en: "El Alamein" },
    { ar: "الضبعة", en: "Dabaa" }, { ar: "سيوة", en: "Siwa" },
    { ar: "السلوم", en: "Sallum" }, { ar: "براني", en: "Barrani" },
  ]},
  SIN: { ar: "شمال سيناء", en: "North Sinai", cities: [
    { ar: "العريش", en: "Arish" }, { ar: "بئر العبد", en: "Bir Al Abd" },
    { ar: "الشيخ زويد", en: "Sheikh Zuweid" }, { ar: "رفح", en: "Rafah" },
    { ar: "نخل", en: "Nakhl" },
  ]},
  SSN: { ar: "جنوب سيناء", en: "South Sinai", cities: [
    { ar: "الطور", en: "El Tor" }, { ar: "شرم الشيخ", en: "Sharm El Sheikh" },
    { ar: "دهب", en: "Dahab" }, { ar: "نويبع", en: "Nuweiba" },
    { ar: "طابا", en: "Taba" }, { ar: "سانت كاترين", en: "Saint Catherine" },
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
