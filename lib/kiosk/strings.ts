/**
 * Kiosk UI strings for the 11 TTS-capable languages. `welcome` and
 * `didNotCatch` are also spoken aloud, so keep them short and plain.
 */

import type { TTS_LANGUAGES } from "@/lib/languages";

export type KioskLang = (typeof TTS_LANGUAGES)[number];

export interface KioskTopic {
  label: string;
  /** Sent to the assistant as the citizen's question. */
  prompt: string;
}

export interface KioskStrings {
  appName: string;
  welcome: string;
  holdToTalk: string;
  idleHint: string;
  listening: string;
  thinking: string;
  speaking: string;
  newPerson: string;
  changeLanguage: string;
  replay: string;
  topics: [KioskTopic, KioskTopic, KioskTopic, KioskTopic];
  you: string;
  assistant: string;
  receiptTitle: string;
  referenceNo: string;
  scanToTrack: string;
  printReceipt: string;
  close: string;
  stillThere: string;
  didNotCatch: string;
  notSignedIn: string;
}

export const KIOSK_STRINGS: Record<KioskLang, KioskStrings> = {
  en: {
    appName: "Sahayak",
    welcome:
      "Welcome to Sahayak, your cooperative help desk. Press and hold the talk button, ask your question, then let go.",
    holdToTalk: "Hold to talk",
    idleHint: "Press and hold the button, speak, then let go.",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    newPerson: "New person",
    changeLanguage: "Change language",
    replay: "Replay answer",
    topics: [
      {
        label: "Laws & membership",
        prompt:
          "How can I become a member of a primary agricultural cooperative society (PACS), and what are my rights as a member?",
      },
      {
        label: "Schemes",
        prompt:
          "Which Ministry of Cooperation schemes can help the members of my cooperative society?",
      },
      {
        label: "PMFBY crop insurance",
        prompt:
          "How does PMFBY crop insurance work, and how much premium does a farmer pay?",
      },
      {
        label: "File a complaint",
        prompt: "I want to file a complaint about my cooperative society.",
      },
    ],
    you: "You",
    assistant: "Sahayak",
    receiptTitle: "Grievance registered",
    referenceNo: "Reference number",
    scanToTrack: "Scan to track your complaint",
    printReceipt: "Print receipt",
    close: "Close",
    stillThere: "Still there? Tap anywhere",
    didNotCatch: "Sorry, I didn't catch that. Please hold the button while you speak.",
    notSignedIn: "Kiosk not signed in. Operator: sign in with the kiosk account",
  },
  hi: {
    appName: "सहायक",
    welcome:
      "सहायक में आपका स्वागत है। यह आपका सहकारी सहायता केंद्र है। बटन दबाकर रखें, अपना सवाल बोलें, फिर बटन छोड़ दें।",
    holdToTalk: "दबाकर बोलें",
    idleHint: "बटन दबाकर रखें, बोलें, फिर छोड़ दें।",
    listening: "सुन रहा हूँ…",
    thinking: "सोच रहा हूँ…",
    speaking: "बोल रहा हूँ…",
    newPerson: "नया व्यक्ति",
    changeLanguage: "भाषा बदलें",
    replay: "जवाब दोबारा सुनें",
    topics: [
      {
        label: "कानून और सदस्यता",
        prompt:
          "मैं प्राथमिक कृषि सहकारी समिति (PACS) का सदस्य कैसे बन सकता हूँ, और सदस्य के रूप में मेरे क्या अधिकार हैं?",
      },
      {
        label: "योजनाएँ",
        prompt:
          "सहकारिता मंत्रालय की कौन-सी योजनाएँ मेरी सहकारी समिति के सदस्यों की मदद कर सकती हैं?",
      },
      {
        label: "फसल बीमा (PMFBY)",
        prompt:
          "प्रधानमंत्री फसल बीमा योजना कैसे काम करती है, और किसान को कितना प्रीमियम देना होता है?",
      },
      {
        label: "शिकायत दर्ज करें",
        prompt: "मैं अपनी सहकारी समिति के बारे में शिकायत दर्ज करना चाहता हूँ।",
      },
    ],
    you: "आप",
    assistant: "सहायक",
    receiptTitle: "शिकायत दर्ज हो गई",
    referenceNo: "संदर्भ संख्या",
    scanToTrack: "अपनी शिकायत की स्थिति देखने के लिए स्कैन करें",
    printReceipt: "रसीद प्रिंट करें",
    close: "बंद करें",
    stillThere: "क्या आप अभी भी यहाँ हैं? स्क्रीन पर कहीं भी छुएँ",
    didNotCatch: "माफ़ कीजिए, मैं सुन नहीं पाया। कृपया बोलते समय बटन दबाए रखें।",
    notSignedIn: "कियोस्क साइन इन नहीं है। ऑपरेटर: कियोस्क खाते से साइन इन करें",
  },
  bn: {
    appName: "সহায়ক",
    welcome:
      "সহায়কে আপনাকে স্বাগত। এটি আপনার সমবায় সহায়তা কেন্দ্র। বোতামটি চেপে ধরে রাখুন, আপনার প্রশ্ন বলুন, তারপর বোতামটি ছেড়ে দিন।",
    holdToTalk: "চেপে ধরে বলুন",
    idleHint: "বোতাম চেপে ধরে রাখুন, কথা বলুন, তারপর ছেড়ে দিন।",
    listening: "শুনছি…",
    thinking: "ভাবছি…",
    speaking: "বলছি…",
    newPerson: "নতুন ব্যক্তি",
    changeLanguage: "ভাষা বদলান",
    replay: "উত্তর আবার শুনুন",
    topics: [
      {
        label: "আইন ও সদস্যপদ",
        prompt:
          "আমি কীভাবে প্রাথমিক কৃষি সমবায় সমিতির (PACS) সদস্য হতে পারি, এবং সদস্য হিসেবে আমার কী কী অধিকার আছে?",
      },
      {
        label: "প্রকল্প",
        prompt:
          "সমবায় মন্ত্রকের কোন কোন প্রকল্প আমার সমবায় সমিতির সদস্যদের সাহায্য করতে পারে?",
      },
      {
        label: "ফসল বিমা (PMFBY)",
        prompt:
          "প্রধানমন্ত্রী ফসল বিমা যোজনা কীভাবে কাজ করে, এবং কৃষককে কত প্রিমিয়াম দিতে হয়?",
      },
      {
        label: "অভিযোগ জানান",
        prompt: "আমি আমার সমবায় সমিতি সম্পর্কে একটি অভিযোগ দায়ের করতে চাই।",
      },
    ],
    you: "আপনি",
    assistant: "সহায়ক",
    receiptTitle: "অভিযোগ নথিভুক্ত হয়েছে",
    referenceNo: "রেফারেন্স নম্বর",
    scanToTrack: "অভিযোগের অবস্থা দেখতে স্ক্যান করুন",
    printReceipt: "রসিদ প্রিন্ট করুন",
    close: "বন্ধ করুন",
    stillThere: "আপনি কি এখনও আছেন? স্ক্রিনের যেকোনো জায়গায় ছুঁয়ে দিন",
    didNotCatch: "দুঃখিত, আমি শুনতে পাইনি। কথা বলার সময় বোতামটি চেপে ধরে রাখুন।",
    notSignedIn: "কিয়স্ক সাইন ইন করা নেই। অপারেটর: কিয়স্ক অ্যাকাউন্ট দিয়ে সাইন ইন করুন",
  },
  ta: {
    appName: "சஹாயக்",
    welcome:
      "சஹாயக்கிற்கு வரவேற்கிறோம். இது உங்கள் கூட்டுறவு உதவி மையம். பொத்தானை அழுத்திப் பிடித்துக்கொண்டு உங்கள் கேள்வியைக் கேளுங்கள், பிறகு பொத்தானை விடுங்கள்.",
    holdToTalk: "அழுத்திப் பேசுங்கள்",
    idleHint: "பொத்தானை அழுத்திப் பிடித்து, பேசி, பிறகு விடுங்கள்.",
    listening: "கேட்கிறேன்…",
    thinking: "யோசிக்கிறேன்…",
    speaking: "பேசுகிறேன்…",
    newPerson: "புதிய நபர்",
    changeLanguage: "மொழியை மாற்று",
    replay: "பதிலை மீண்டும் கேள்",
    topics: [
      {
        label: "சட்டங்கள் & உறுப்பினர்",
        prompt:
          "தொடக்க வேளாண்மைக் கூட்டுறவுச் சங்கத்தில் (PACS) நான் எப்படி உறுப்பினராகலாம், உறுப்பினராக என் உரிமைகள் என்ன?",
      },
      {
        label: "திட்டங்கள்",
        prompt:
          "கூட்டுறவு அமைச்சகத்தின் எந்தத் திட்டங்கள் எங்கள் கூட்டுறவுச் சங்க உறுப்பினர்களுக்கு உதவும்?",
      },
      {
        label: "பயிர்க் காப்பீடு (PMFBY)",
        prompt:
          "பிரதமரின் பயிர்க் காப்பீட்டுத் திட்டம் எப்படிச் செயல்படுகிறது, விவசாயி எவ்வளவு பிரீமியம் செலுத்த வேண்டும்?",
      },
      {
        label: "புகார் பதிவு",
        prompt: "எங்கள் கூட்டுறவுச் சங்கம் பற்றி ஒரு புகார் பதிவு செய்ய விரும்புகிறேன்.",
      },
    ],
    you: "நீங்கள்",
    assistant: "சஹாயக்",
    receiptTitle: "புகார் பதிவு செய்யப்பட்டது",
    referenceNo: "குறிப்பு எண்",
    scanToTrack: "உங்கள் புகாரின் நிலையை அறிய ஸ்கேன் செய்யுங்கள்",
    printReceipt: "ரசீது அச்சிடு",
    close: "மூடு",
    stillThere: "இன்னும் இருக்கிறீர்களா? திரையில் எங்காவது தொடுங்கள்",
    didNotCatch:
      "மன்னிக்கவும், எனக்குக் கேட்கவில்லை. பேசும்போது பொத்தானை அழுத்திப் பிடித்திருங்கள்.",
    notSignedIn: "கியோஸ்க் உள்நுழையவில்லை. இயக்குநர்: கியோஸ்க் கணக்கில் உள்நுழையவும்",
  },
  te: {
    appName: "సహాయక్",
    welcome:
      "సహాయక్‌కు స్వాగతం. ఇది మీ సహకార సహాయ కేంద్రం. బటన్‌ను నొక్కి పట్టుకుని మీ ప్రశ్న అడగండి, తర్వాత బటన్‌ను వదిలేయండి.",
    holdToTalk: "నొక్కి పట్టుకుని మాట్లాడండి",
    idleHint: "బటన్‌ను నొక్కి పట్టుకుని, మాట్లాడి, తర్వాత వదలండి.",
    listening: "వింటున్నాను…",
    thinking: "ఆలోచిస్తున్నాను…",
    speaking: "చెబుతున్నాను…",
    newPerson: "కొత్త వ్యక్తి",
    changeLanguage: "భాష మార్చండి",
    replay: "సమాధానం మళ్ళీ వినండి",
    topics: [
      {
        label: "చట్టాలు & సభ్యత్వం",
        prompt:
          "ప్రాథమిక వ్యవసాయ సహకార సంఘం (PACS)లో నేను ఎలా సభ్యుడిని కావచ్చు, సభ్యుడిగా నా హక్కులు ఏమిటి?",
      },
      {
        label: "పథకాలు",
        prompt:
          "సహకార మంత్రిత్వ శాఖ యొక్క ఏ పథకాలు మా సహకార సంఘ సభ్యులకు సహాయపడతాయి?",
      },
      {
        label: "పంట బీమా (PMFBY)",
        prompt:
          "ప్రధానమంత్రి ఫసల్ బీమా యోజన ఎలా పనిచేస్తుంది, రైతు ఎంత ప్రీమియం చెల్లించాలి?",
      },
      {
        label: "ఫిర్యాదు చేయండి",
        prompt: "మా సహకార సంఘం గురించి నేను ఫిర్యాదు నమోదు చేయాలనుకుంటున్నాను.",
      },
    ],
    you: "మీరు",
    assistant: "సహాయక్",
    receiptTitle: "ఫిర్యాదు నమోదైంది",
    referenceNo: "రిఫరెన్స్ నంబర్",
    scanToTrack: "మీ ఫిర్యాదు స్థితి తెలుసుకోవడానికి స్కాన్ చేయండి",
    printReceipt: "రసీదు ప్రింట్ చేయండి",
    close: "మూసివేయండి",
    stillThere: "మీరు ఇంకా ఉన్నారా? స్క్రీన్‌పై ఎక్కడైనా తాకండి",
    didNotCatch:
      "క్షమించండి, నాకు వినిపించలేదు. మాట్లాడేటప్పుడు బటన్‌ను నొక్కి పట్టుకోండి.",
    notSignedIn: "కియోస్క్ సైన్ ఇన్ కాలేదు. ఆపరేటర్: కియోస్క్ ఖాతాతో సైన్ ఇన్ చేయండి",
  },
  kn: {
    appName: "ಸಹಾಯಕ್",
    welcome:
      "ಸಹಾಯಕ್‌ಗೆ ಸ್ವಾಗತ. ಇದು ನಿಮ್ಮ ಸಹಕಾರಿ ಸಹಾಯ ಕೇಂದ್ರ. ಬಟನ್ ಒತ್ತಿ ಹಿಡಿದು ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಕೇಳಿ, ನಂತರ ಬಟನ್ ಬಿಡಿ.",
    holdToTalk: "ಒತ್ತಿ ಹಿಡಿದು ಮಾತನಾಡಿ",
    idleHint: "ಬಟನ್ ಒತ್ತಿ ಹಿಡಿದು, ಮಾತನಾಡಿ, ನಂತರ ಬಿಡಿ.",
    listening: "ಕೇಳುತ್ತಿದ್ದೇನೆ…",
    thinking: "ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ…",
    speaking: "ಹೇಳುತ್ತಿದ್ದೇನೆ…",
    newPerson: "ಹೊಸ ವ್ಯಕ್ತಿ",
    changeLanguage: "ಭಾಷೆ ಬದಲಿಸಿ",
    replay: "ಉತ್ತರ ಮತ್ತೆ ಕೇಳಿ",
    topics: [
      {
        label: "ಕಾನೂನು & ಸದಸ್ಯತ್ವ",
        prompt:
          "ಪ್ರಾಥಮಿಕ ಕೃಷಿ ಸಹಕಾರ ಸಂಘದ (PACS) ಸದಸ್ಯನಾಗುವುದು ಹೇಗೆ, ಮತ್ತು ಸದಸ್ಯನಾಗಿ ನನ್ನ ಹಕ್ಕುಗಳೇನು?",
      },
      {
        label: "ಯೋಜನೆಗಳು",
        prompt:
          "ಸಹಕಾರ ಸಚಿವಾಲಯದ ಯಾವ ಯೋಜನೆಗಳು ನಮ್ಮ ಸಹಕಾರ ಸಂಘದ ಸದಸ್ಯರಿಗೆ ನೆರವಾಗುತ್ತವೆ?",
      },
      {
        label: "ಬೆಳೆ ವಿಮೆ (PMFBY)",
        prompt:
          "ಪ್ರಧಾನ ಮಂತ್ರಿ ಫಸಲ್ ಬಿಮಾ ಯೋಜನೆ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ, ಮತ್ತು ರೈತರು ಎಷ್ಟು ಪ್ರೀಮಿಯಂ ಕಟ್ಟಬೇಕು?",
      },
      {
        label: "ದೂರು ನೀಡಿ",
        prompt: "ನಮ್ಮ ಸಹಕಾರ ಸಂಘದ ಬಗ್ಗೆ ನಾನು ದೂರು ದಾಖಲಿಸಲು ಬಯಸುತ್ತೇನೆ.",
      },
    ],
    you: "ನೀವು",
    assistant: "ಸಹಾಯಕ್",
    receiptTitle: "ದೂರು ದಾಖಲಾಗಿದೆ",
    referenceNo: "ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ",
    scanToTrack: "ನಿಮ್ಮ ದೂರಿನ ಸ್ಥಿತಿ ತಿಳಿಯಲು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ",
    printReceipt: "ರಸೀದಿ ಮುದ್ರಿಸಿ",
    close: "ಮುಚ್ಚಿ",
    stillThere: "ನೀವು ಇನ್ನೂ ಇದ್ದೀರಾ? ಪರದೆಯ ಮೇಲೆ ಎಲ್ಲಾದರೂ ಸ್ಪರ್ಶಿಸಿ",
    didNotCatch: "ಕ್ಷಮಿಸಿ, ನನಗೆ ಕೇಳಿಸಲಿಲ್ಲ. ಮಾತನಾಡುವಾಗ ಬಟನ್ ಒತ್ತಿ ಹಿಡಿದಿರಿ.",
    notSignedIn: "ಕಿಯೋಸ್ಕ್ ಸೈನ್ ಇನ್ ಆಗಿಲ್ಲ. ಆಪರೇಟರ್: ಕಿಯೋಸ್ಕ್ ಖಾತೆಯಿಂದ ಸೈನ್ ಇನ್ ಮಾಡಿ",
  },
  ml: {
    appName: "സഹായക്",
    welcome:
      "സഹായക്കിലേക്ക് സ്വാഗതം. ഇത് നിങ്ങളുടെ സഹകരണ സഹായ കേന്ദ്രമാണ്. ബട്ടൺ അമർത്തിപ്പിടിച്ച് നിങ്ങളുടെ ചോദ്യം ചോദിക്കൂ, എന്നിട്ട് ബട്ടൺ വിടൂ.",
    holdToTalk: "അമർത്തിപ്പിടിച്ച് സംസാരിക്കൂ",
    idleHint: "ബട്ടൺ അമർത്തിപ്പിടിച്ച് സംസാരിക്കൂ, എന്നിട്ട് വിടൂ.",
    listening: "കേൾക്കുന്നു…",
    thinking: "ആലോചിക്കുന്നു…",
    speaking: "പറയുന്നു…",
    newPerson: "പുതിയ ആൾ",
    changeLanguage: "ഭാഷ മാറ്റുക",
    replay: "ഉത്തരം വീണ്ടും കേൾക്കുക",
    topics: [
      {
        label: "നിയമങ്ങളും അംഗത്വവും",
        prompt:
          "പ്രാഥമിക കാർഷിക സഹകരണ സംഘത്തിൽ (PACS) എനിക്ക് എങ്ങനെ അംഗമാകാം, അംഗമെന്ന നിലയിൽ എന്റെ അവകാശങ്ങൾ എന്തൊക്കെയാണ്?",
      },
      {
        label: "പദ്ധതികൾ",
        prompt:
          "സഹകരണ മന്ത്രാലയത്തിന്റെ ഏതൊക്കെ പദ്ധതികൾ ഞങ്ങളുടെ സഹകരണ സംഘത്തിലെ അംഗങ്ങൾക്ക് സഹായകമാകും?",
      },
      {
        label: "വിള ഇൻഷുറൻസ് (PMFBY)",
        prompt:
          "പ്രധാനമന്ത്രി ഫസൽ ബീമാ യോജന എങ്ങനെയാണ് പ്രവർത്തിക്കുന്നത്, കർഷകൻ എത്ര പ്രീമിയം അടയ്ക്കണം?",
      },
      {
        label: "പരാതി നൽകുക",
        prompt: "ഞങ്ങളുടെ സഹകരണ സംഘത്തെക്കുറിച്ച് എനിക്ക് ഒരു പരാതി രജിസ്റ്റർ ചെയ്യണം.",
      },
    ],
    you: "നിങ്ങൾ",
    assistant: "സഹായക്",
    receiptTitle: "പരാതി രജിസ്റ്റർ ചെയ്തു",
    referenceNo: "റഫറൻസ് നമ്പർ",
    scanToTrack: "പരാതിയുടെ നില അറിയാൻ സ്കാൻ ചെയ്യുക",
    printReceipt: "രസീത് പ്രിന്റ് ചെയ്യുക",
    close: "അടയ്ക്കുക",
    stillThere: "നിങ്ങൾ ഇപ്പോഴും ഇവിടെയുണ്ടോ? സ്ക്രീനിൽ എവിടെയെങ്കിലും തൊടുക",
    didNotCatch:
      "ക്ഷമിക്കണം, എനിക്ക് കേൾക്കാനായില്ല. സംസാരിക്കുമ്പോൾ ബട്ടൺ അമർത്തിപ്പിടിക്കുക.",
    notSignedIn:
      "കിയോസ്ക് സൈൻ ഇൻ ചെയ്തിട്ടില്ല. ഓപ്പറേറ്റർ: കിയോസ്ക് അക്കൗണ്ട് ഉപയോഗിച്ച് സൈൻ ഇൻ ചെയ്യുക",
  },
  mr: {
    appName: "सहायक",
    welcome:
      "सहायकमध्ये आपले स्वागत आहे. हे आपले सहकारी मदत केंद्र आहे. बटण दाबून ठेवा, आपला प्रश्न विचारा आणि मग बटण सोडा.",
    holdToTalk: "दाबून बोला",
    idleHint: "बटण दाबून ठेवा, बोला आणि मग सोडा.",
    listening: "ऐकत आहे…",
    thinking: "विचार करत आहे…",
    speaking: "बोलत आहे…",
    newPerson: "नवीन व्यक्ती",
    changeLanguage: "भाषा बदला",
    replay: "उत्तर पुन्हा ऐका",
    topics: [
      {
        label: "कायदे व सदस्यत्व",
        prompt:
          "मी प्राथमिक कृषी सहकारी संस्थेचा (PACS) सदस्य कसा होऊ शकतो आणि सदस्य म्हणून माझे अधिकार काय आहेत?",
      },
      {
        label: "योजना",
        prompt:
          "सहकार मंत्रालयाच्या कोणत्या योजना माझ्या सहकारी संस्थेच्या सदस्यांना मदत करू शकतात?",
      },
      {
        label: "पीक विमा (PMFBY)",
        prompt:
          "प्रधानमंत्री पीक विमा योजना कशी काम करते आणि शेतकऱ्याला किती हप्ता भरावा लागतो?",
      },
      {
        label: "तक्रार नोंदवा",
        prompt: "मला माझ्या सहकारी संस्थेबद्दल तक्रार नोंदवायची आहे.",
      },
    ],
    you: "आपण",
    assistant: "सहायक",
    receiptTitle: "तक्रार नोंदवली गेली",
    referenceNo: "संदर्भ क्रमांक",
    scanToTrack: "तक्रारीची स्थिती पाहण्यासाठी स्कॅन करा",
    printReceipt: "पावती छापा",
    close: "बंद करा",
    stillThere: "आपण अजून आहात का? स्क्रीनवर कुठेही स्पर्श करा",
    didNotCatch: "माफ करा, मला ऐकू आले नाही. कृपया बोलताना बटण दाबून ठेवा.",
    notSignedIn: "किऑस्क साइन इन केलेले नाही. ऑपरेटर: किऑस्क खात्याने साइन इन करा",
  },
  gu: {
    appName: "સહાયક",
    welcome:
      "સહાયકમાં આપનું સ્વાગત છે. આ આપનું સહકારી સહાય કેન્દ્ર છે. બટન દબાવી રાખો, તમારો પ્રશ્ન પૂછો, પછી બટન છોડી દો.",
    holdToTalk: "દબાવીને બોલો",
    idleHint: "બટન દબાવી રાખો, બોલો, પછી છોડી દો.",
    listening: "સાંભળી રહ્યો છું…",
    thinking: "વિચારી રહ્યો છું…",
    speaking: "બોલી રહ્યો છું…",
    newPerson: "નવી વ્યક્તિ",
    changeLanguage: "ભાષા બદલો",
    replay: "જવાબ ફરી સાંભળો",
    topics: [
      {
        label: "કાયદા અને સભ્યપદ",
        prompt:
          "હું પ્રાથમિક કૃષિ સહકારી મંડળી (PACS)નો સભ્ય કેવી રીતે બની શકું, અને સભ્ય તરીકે મારા કયા અધિકારો છે?",
      },
      {
        label: "યોજનાઓ",
        prompt:
          "સહકાર મંત્રાલયની કઈ યોજનાઓ અમારી સહકારી મંડળીના સભ્યોને મદદ કરી શકે?",
      },
      {
        label: "પાક વીમો (PMFBY)",
        prompt:
          "પ્રધાનમંત્રી પાક વીમા યોજના કેવી રીતે કામ કરે છે, અને ખેડૂતે કેટલું પ્રીમિયમ ભરવું પડે?",
      },
      {
        label: "ફરિયાદ નોંધાવો",
        prompt: "મારે અમારી સહકારી મંડળી વિશે ફરિયાદ નોંધાવવી છે.",
      },
    ],
    you: "તમે",
    assistant: "સહાયક",
    receiptTitle: "ફરિયાદ નોંધાઈ ગઈ",
    referenceNo: "સંદર્ભ નંબર",
    scanToTrack: "ફરિયાદની સ્થિતિ જોવા માટે સ્કેન કરો",
    printReceipt: "રસીદ છાપો",
    close: "બંધ કરો",
    stillThere: "શું તમે હજી અહીં છો? સ્ક્રીન પર ક્યાંય પણ સ્પર્શ કરો",
    didNotCatch: "માફ કરશો, મને સંભળાયું નહીં. બોલતી વખતે બટન દબાવી રાખો.",
    notSignedIn: "કિઓસ્ક સાઇન ઇન નથી. ઓપરેટર: કિઓસ્ક ખાતાથી સાઇન ઇન કરો",
  },
  pa: {
    appName: "ਸਹਾਇਕ",
    welcome:
      "ਸਹਾਇਕ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਇਹ ਤੁਹਾਡਾ ਸਹਿਕਾਰੀ ਸਹਾਇਤਾ ਕੇਂਦਰ ਹੈ। ਬਟਨ ਦਬਾ ਕੇ ਰੱਖੋ, ਆਪਣਾ ਸਵਾਲ ਪੁੱਛੋ, ਫਿਰ ਬਟਨ ਛੱਡ ਦਿਓ।",
    holdToTalk: "ਦਬਾ ਕੇ ਬੋਲੋ",
    idleHint: "ਬਟਨ ਦਬਾ ਕੇ ਰੱਖੋ, ਬੋਲੋ, ਫਿਰ ਛੱਡ ਦਿਓ।",
    listening: "ਸੁਣ ਰਿਹਾ ਹਾਂ…",
    thinking: "ਸੋਚ ਰਿਹਾ ਹਾਂ…",
    speaking: "ਬੋਲ ਰਿਹਾ ਹਾਂ…",
    newPerson: "ਨਵਾਂ ਵਿਅਕਤੀ",
    changeLanguage: "ਭਾਸ਼ਾ ਬਦਲੋ",
    replay: "ਜਵਾਬ ਦੁਬਾਰਾ ਸੁਣੋ",
    topics: [
      {
        label: "ਕਾਨੂੰਨ ਅਤੇ ਮੈਂਬਰਸ਼ਿਪ",
        prompt:
          "ਮੈਂ ਮੁਢਲੀ ਖੇਤੀਬਾੜੀ ਸਹਿਕਾਰੀ ਸਭਾ (PACS) ਦਾ ਮੈਂਬਰ ਕਿਵੇਂ ਬਣ ਸਕਦਾ ਹਾਂ, ਅਤੇ ਮੈਂਬਰ ਵਜੋਂ ਮੇਰੇ ਕੀ ਅਧਿਕਾਰ ਹਨ?",
      },
      {
        label: "ਯੋਜਨਾਵਾਂ",
        prompt:
          "ਸਹਿਕਾਰਤਾ ਮੰਤਰਾਲੇ ਦੀਆਂ ਕਿਹੜੀਆਂ ਯੋਜਨਾਵਾਂ ਸਾਡੀ ਸਹਿਕਾਰੀ ਸਭਾ ਦੇ ਮੈਂਬਰਾਂ ਦੀ ਮਦਦ ਕਰ ਸਕਦੀਆਂ ਹਨ?",
      },
      {
        label: "ਫ਼ਸਲ ਬੀਮਾ (PMFBY)",
        prompt:
          "ਪ੍ਰਧਾਨ ਮੰਤਰੀ ਫ਼ਸਲ ਬੀਮਾ ਯੋਜਨਾ ਕਿਵੇਂ ਕੰਮ ਕਰਦੀ ਹੈ, ਅਤੇ ਕਿਸਾਨ ਨੂੰ ਕਿੰਨਾ ਪ੍ਰੀਮੀਅਮ ਦੇਣਾ ਪੈਂਦਾ ਹੈ?",
      },
      {
        label: "ਸ਼ਿਕਾਇਤ ਦਰਜ ਕਰੋ",
        prompt: "ਮੈਂ ਆਪਣੀ ਸਹਿਕਾਰੀ ਸਭਾ ਬਾਰੇ ਸ਼ਿਕਾਇਤ ਦਰਜ ਕਰਨੀ ਚਾਹੁੰਦਾ ਹਾਂ।",
      },
    ],
    you: "ਤੁਸੀਂ",
    assistant: "ਸਹਾਇਕ",
    receiptTitle: "ਸ਼ਿਕਾਇਤ ਦਰਜ ਹੋ ਗਈ",
    referenceNo: "ਹਵਾਲਾ ਨੰਬਰ",
    scanToTrack: "ਆਪਣੀ ਸ਼ਿਕਾਇਤ ਦੀ ਸਥਿਤੀ ਦੇਖਣ ਲਈ ਸਕੈਨ ਕਰੋ",
    printReceipt: "ਰਸੀਦ ਪ੍ਰਿੰਟ ਕਰੋ",
    close: "ਬੰਦ ਕਰੋ",
    stillThere: "ਕੀ ਤੁਸੀਂ ਅਜੇ ਵੀ ਇੱਥੇ ਹੋ? ਸਕ੍ਰੀਨ 'ਤੇ ਕਿਤੇ ਵੀ ਛੂਹੋ",
    didNotCatch: "ਮਾਫ਼ ਕਰਨਾ, ਮੈਨੂੰ ਸੁਣਾਈ ਨਹੀਂ ਦਿੱਤਾ। ਬੋਲਦੇ ਸਮੇਂ ਬਟਨ ਦਬਾ ਕੇ ਰੱਖੋ।",
    notSignedIn: "ਕਿਓਸਕ ਸਾਈਨ ਇਨ ਨਹੀਂ ਹੈ। ਆਪਰੇਟਰ: ਕਿਓਸਕ ਖਾਤੇ ਨਾਲ ਸਾਈਨ ਇਨ ਕਰੋ",
  },
  or: {
    appName: "ସହାୟକ",
    welcome:
      "ସହାୟକକୁ ଆପଣଙ୍କୁ ସ୍ୱାଗତ। ଏହା ଆପଣଙ୍କ ସମବାୟ ସହାୟତା କେନ୍ଦ୍ର। ବଟନଟି ଚାପି ଧରି ରଖନ୍ତୁ, ଆପଣଙ୍କ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ, ତା'ପରେ ବଟନ ଛାଡି ଦିଅନ୍ତୁ।",
    holdToTalk: "ଚାପି ଧରି କୁହନ୍ତୁ",
    idleHint: "ବଟନ ଚାପି ଧରି ରଖନ୍ତୁ, କୁହନ୍ତୁ, ତା'ପରେ ଛାଡି ଦିଅନ୍ତୁ।",
    listening: "ଶୁଣୁଛି…",
    thinking: "ଭାବୁଛି…",
    speaking: "କହୁଛି…",
    newPerson: "ନୂଆ ବ୍ୟକ୍ତି",
    changeLanguage: "ଭାଷା ବଦଳାନ୍ତୁ",
    replay: "ଉତ୍ତର ପୁଣି ଶୁଣନ୍ତୁ",
    topics: [
      {
        label: "ଆଇନ ଓ ସଦସ୍ୟତା",
        prompt:
          "ମୁଁ ପ୍ରାଥମିକ କୃଷି ସମବାୟ ସମିତି (PACS)ର ସଦସ୍ୟ କିପରି ହୋଇପାରିବି, ଏବଂ ସଦସ୍ୟ ଭାବେ ମୋର ଅଧିକାର କ'ଣ?",
      },
      {
        label: "ଯୋଜନା",
        prompt:
          "ସମବାୟ ମନ୍ତ୍ରଣାଳୟର କେଉଁ ଯୋଜନାଗୁଡ଼ିକ ଆମ ସମବାୟ ସମିତିର ସଦସ୍ୟମାନଙ୍କୁ ସାହାଯ୍ୟ କରିପାରିବ?",
      },
      {
        label: "ଫସଲ ବୀମା (PMFBY)",
        prompt:
          "ପ୍ରଧାନମନ୍ତ୍ରୀ ଫସଲ ବୀମା ଯୋଜନା କିପରି କାମ କରେ, ଏବଂ ଚାଷୀଙ୍କୁ କେତେ ପ୍ରିମିୟମ ଦେବାକୁ ପଡ଼େ?",
      },
      {
        label: "ଅଭିଯୋଗ କରନ୍ତୁ",
        prompt: "ମୁଁ ଆମ ସମବାୟ ସମିତି ବିଷୟରେ ଏକ ଅଭିଯୋଗ ଦାଖଲ କରିବାକୁ ଚାହୁଁଛି।",
      },
    ],
    you: "ଆପଣ",
    assistant: "ସହାୟକ",
    receiptTitle: "ଅଭିଯୋଗ ପଞ୍ଜୀକୃତ ହେଲା",
    referenceNo: "ସନ୍ଦର୍ଭ ନମ୍ବର",
    scanToTrack: "ଅଭିଯୋଗର ସ୍ଥିତି ଜାଣିବାକୁ ସ୍କାନ କରନ୍ତୁ",
    printReceipt: "ରସିଦ ପ୍ରିଣ୍ଟ କରନ୍ତୁ",
    close: "ବନ୍ଦ କରନ୍ତୁ",
    stillThere: "ଆପଣ ଏବେ ବି ଅଛନ୍ତି କି? ସ୍କ୍ରିନର ଯେକୌଣସି ସ୍ଥାନରେ ଛୁଅଁନ୍ତୁ",
    didNotCatch: "କ୍ଷମା କରିବେ, ମୁଁ ଶୁଣିପାରିଲି ନାହିଁ। କହିବା ସମୟରେ ବଟନଟି ଚାପି ଧରି ରଖନ୍ତୁ।",
    notSignedIn: "କିଓସ୍କ ସାଇନ ଇନ ହୋଇନାହିଁ। ଅପରେଟର: କିଓସ୍କ ଆକାଉଣ୍ଟରେ ସାଇନ ଇନ କରନ୍ତୁ",
  },
};

/** A kiosk string in `lang`, falling back to English. */
export function kioskT<K extends keyof KioskStrings>(
  lang: string | null | undefined,
  key: K
): KioskStrings[K] {
  const dict = lang ? KIOSK_STRINGS[lang as KioskLang] : undefined;
  return dict?.[key] || KIOSK_STRINGS.en[key];
}
