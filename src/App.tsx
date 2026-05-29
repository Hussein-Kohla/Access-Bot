import React, { useState, useEffect, useRef } from 'react';
import { Camera, Edit3, Image as ImageIcon, Copy } from 'lucide-react';
import './index.css';

interface ImageState {
  base64: string | null;
  mimeType: string;
  url: string | null;
}

interface NameResult {
  name: string;
  checked: boolean;
}

export default function App() {
  const [apiKey, setApiKey] = useState<string>('AQ.Ab8RN6Jm8kBBsRPoWVwPzpVfVSlPJQgytM3ztBcES73JOrRRAA');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalKeyInput, setModalKeyInput] = useState<string>('');
  const [inlineKeyInput, setInlineKeyInput] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastShow, setToastShow] = useState<boolean>(false);
  
  const [tableName, setTableName] = useState<string>('Table1');
  const [nameField, setNameField] = useState<string>('الاسم');
  const [checkField, setCheckField] = useState<string>('م ط');
  const [updateValue, setUpdateValue] = useState<boolean>(true);
  
  const [image, setImage] = useState<ImageState>({ base64: null, mimeType: 'image/jpeg', url: null });
  const [imgError, setImgError] = useState<string>('');
  const [namesInput, setNamesInput] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<NameResult[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gemini_api_key');
      if (saved) setApiKey(saved);
    } catch(e) {}
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 2800);
  };
  
  const handleSaveModalKey = () => {
    if (!modalKeyInput.trim()) { showToast('من فضلك أدخل المفتاح أولاً'); return; }
    setApiKey(modalKeyInput.trim());
    try { localStorage.setItem('gemini_api_key', modalKeyInput.trim()); } catch(e) {}
    setShowModal(false);
    showToast('✅ تم حفظ المفتاح بنجاح!');
  };

  const handleSaveInlineKey = () => {
    if (!inlineKeyInput.trim()) { showToast('من فضلك أدخل المفتاح أولاً'); return; }
    setApiKey(inlineKeyInput.trim());
    try { localStorage.setItem('gemini_api_key', inlineKeyInput.trim()); } catch(e) {}
    showToast('✅ تم حفظ المفتاح بنجاح!');
  };

  const handleFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('❌ من فضلك ارفع صورة فقط (PNG أو JPG)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) return;
      const resultString = e.target.result as string;
      setImage({
        base64: resultString.split(',')[1],
        mimeType: file.type || 'image/jpeg',
        url: resultString
      });
      setImgError('');
    };
    reader.readAsDataURL(file);
  };
  
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  };
  
  const callGemini = async (prompt: string, imageData: string | null, mimeType: string) => {
    if (!apiKey) {
      setShowModal(true);
      throw new Error('no_api_key');
    }
    const parts: any[] = [];
    if (imageData) parts.push({ inline_data: { mime_type: mimeType, data: imageData } });
    parts.push({ text: prompt });

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { 
          temperature: 0.1, 
          maxOutputTokens: 8192, 
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              names: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    checked: { type: "BOOLEAN" }
                  },
                  required: ["name", "checked"]
                }
              }
            },
            required: ["names"]
          }
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = (errData.error && errData.error.message) ? errData.error.message : 'خطأ في API';
      throw new Error(errMsg);
    }
    const data = await response.json();
    if (!data.candidates || !data.candidates[0]) throw new Error('لا يوجد رد من Gemini');
    return data.candidates[0].content.parts[0].text || '';
  };

  const handleAnalyzeImage = async () => {
    if (!image.base64) return;
    if (!apiKey) { setShowModal(true); return; }
    
    setLoading(true);
    setImgError('');
    try {
      const prompt = 'أنت مساعد متخصص في تحليل القوائم الاسمية العربية. استخرج كل الأسماء العربية من هذه الصورة وحدد مين عليه علامة صح أو تيك أو أي علامة تأكيد بجانب اسمه ومين مش عليه. أجب بـ JSON فقط بدون أي نص إضافي ولا backticks ولا markdown. الشكل المطلوب بالضبط: {"names":[{"name":"الاسم كاملاً","checked":true},{"name":"اسم تاني","checked":false}]}';
      
      const raw = await callGemini(prompt, image.base64, image.mimeType);
      
      let clean = raw.trim();
      clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      
      let parsed: { names?: NameResult[] } | undefined;
      try {
        parsed = JSON.parse(clean);
      } catch(e) {
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error('فشل في قراءة رد الذكاء الاصطناعي');
      }
      
      const names = parsed?.names || [];
      if (names.length === 0) {
        setImgError('لم يتم التعرف على أسماء في الصورة — تأكد أن الصورة واضحة وتحتوي على قائمة أسماء');
      } else {
        displayResults(names);
      }
    } catch (e: any) {
      if (e.message !== 'no_api_key') {
        setImgError('❌ خطأ: ' + e.message + ' — تأكد من صحة المفتاح ووضوح الصورة');
      }
    }
    setLoading(false);
  };

  const handleAnalyzeText = () => {
    if (!namesInput.trim()) { showToast('اكتب الأسماء أولاً'); return; }
    const names = namesInput.split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0)
      .map(n => ({ name: n, checked: true }));
    displayResults(names);
  };
  
  const displayResults = (names: NameResult[]) => {
    setResults(names);
    setShowResults(true);
    setTimeout(() => {
      document.getElementById('results-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const computedCheckedNames = results.filter(n => n.checked).map(n => n.name);
  let computedSqlOutput = '-- لم يتم التعرف على أسماء';
  if (computedCheckedNames.length > 0) {
    const inList = computedCheckedNames.map(n => '"' + n.replace(/"/g, '""') + '"').join(', ');
    computedSqlOutput = `UPDATE [${tableName || 'Table1'}]\nSET [${checkField || 'م ط'}] = ${updateValue ? 'True' : 'False'}\nWHERE [${nameField || 'الاسم'}] IN (${inList});`;
  }

  const copySQL = () => {
    if (!computedSqlOutput) return;
    navigator.clipboard.writeText(computedSqlOutput)
      .then(() => showToast('✅ تم نسخ الكود!'))
      .catch(() => showToast('❌ حدث خطأ في النسخ'));
  };

  const checkedCount = results.filter(n => n.checked).length;

  return (
    <>
      <div className={`loader-overlay ${loading ? 'show' : ''}`}>
        <div className="spinner"></div>
        <div className="loader-text">Gemini بيحلل الصورة... لحظة</div>
      </div>

      <div className={`toast ${toastShow ? 'show' : ''}`}>{toastMsg}</div>

      <div className={`modal-bg ${showModal ? 'show' : ''}`}>
        <div className="modal">
          <h3>🔑 مفتاح Gemini API <span className="free-badge">مجاني 100%</span></h3>
          <div className="steps-box">
            ١. افتح: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">aistudio.google.com/app/apikey</a><br/>
            ٢. سجل دخول بحساب Google<br/>
            ٣. اضغط <strong>"Create API Key"</strong><br/>
            ٤. انسخ المفتاح والصقه هنا ⬇️
          </div>
          <label>مفتاح Gemini API</label>
          <input 
            type="password" 
            placeholder="AIzaSy..." 
            value={modalKeyInput} 
            onChange={(e) => setModalKeyInput(e.target.value)} 
          />
          <div className="modal-btns">
            <button className="btn-modal-cancel" onClick={() => setShowModal(false)}>إلغاء</button>
            <button className="btn-modal-save" onClick={handleSaveModalKey}>حفظ المفتاح ✓</button>
          </div>
        </div>
      </div>

      <div className="header">
        <div className="header-inner">
          <div className="logo">
            <img src="/logo.png" alt="DataSync AI Logo" className="logo-icon-img" style={{width: 36, height: 36, objectFit: 'cover', borderRadius: '10px'}} />
            <div className="logo-text">
              <h1>DataSync AI</h1>
              <p>مُزامن البيانات الذكي لـ Access</p>
            </div>
          </div>
          <div 
            className={`api-badge ${!apiKey ? 'not-set' : ''}`} 
            onClick={() => {
              setModalKeyInput(apiKey);
              setShowModal(true);
            }}
          >
            <div className="dot"></div>
            <span>{apiKey ? 'Gemini متصل ✓' : 'مفتاح API غير محفوظ'}</span>
          </div>
        </div>
      </div>

      <div className="main">
        {!apiKey && (
          <div className="setup-card show">
            <div className="setup-card-icon">⚠️</div>
            <div style={{ flex: 1 }}>
              <h3>إعداد مفتاح Gemini API المجاني</h3>
              <p>
                ١. افتح <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">aistudio.google.com/app/apikey</a>
                ← سجل بحساب Google ← اضغط <strong>Create API Key</strong> ← انسخ المفتاح والصقه هنا:
              </p>
              <div className="api-input-row">
                <input 
                  type="password" 
                  placeholder="الصق مفتاح Gemini هنا... AIzaSy..." 
                  value={inlineKeyInput}
                  onChange={(e) => setInlineKeyInput(e.target.value)}
                />
                <button className="btn-save-api" onClick={handleSaveInlineKey}>حفظ ✓</button>
              </div>
            </div>
          </div>
        )}

        <div className="db-settings">
          <h4>⚙️ إعدادات قاعدة البيانات</h4>
          <div className="field-row">
            <label>اسم الجدول</label>
            <input type="text" value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="Table1" />
          </div>
          <div className="field-row">
            <label>حقل الاسم</label>
            <input type="text" value={nameField} onChange={(e) => setNameField(e.target.value)} placeholder="الاسم" />
          </div>
          <div className="field-row">
            <label>حقل الدفع</label>
            <input type="text" value={checkField} onChange={(e) => setCheckField(e.target.value)} placeholder="م ط" />
          </div>
          <div className="field-row">
            <label>القيمة المطلوبة</label>
            <select style={{direction: 'rtl'}} value={updateValue ? 'true' : 'false'} onChange={(e) => setUpdateValue(e.target.value === 'true')}>
              <option value="true">صح (True)</option>
              <option value="false">خطأ (False)</option>
            </select>
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <div className="card-header">
              <div className="card-icon blue"><Camera size={18} /></div>
              <div className="card-title">
                <h2>تحليل صورة الورقة</h2>
                <p>ارفع صورة القائمة المطبوعة</p>
              </div>
            </div>
            <div className="card-body">
              <div 
                className="upload-zone" 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
                onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
                onDrop={(e) => { e.currentTarget.classList.remove('dragover'); onDrop(e); }}
              >
                <div className="uz-icon"><ImageIcon size={30} color="var(--text3)" /></div>
                <p>اضغط أو اسحب الصورة هنا</p>
                <small>PNG, JPG, JPEG, WEBP</small>
              </div>
              <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
              
              {image.url && <img src={image.url} className="preview-img show" alt="معاينة" />}
              
              <div className={`error-msg ${imgError ? 'show' : ''}`}>{imgError}</div>
              
              <button 
                className="btn btn-primary" 
                onClick={handleAnalyzeImage} 
                disabled={!image.base64 || loading}
              >
                🔍 حلل الصورة واستخرج الأسماء
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon green"><Edit3 size={18} /></div>
              <div className="card-title">
                <h2>إدخال الأسماء يدوياً</h2>
                <p>اكتب أسماء من دفعوا اليوم</p>
              </div>
            </div>
            <div className="card-body">
              <textarea 
                className="names-area" 
                placeholder="اكتب كل اسم في سطر:&#10;&#10;محمد أحمد&#10;أحمد علي&#10;مصطفى خالد&#10;..."
                value={namesInput}
                onChange={(e) => setNamesInput(e.target.value)}
              ></textarea>
              <button className="btn btn-green" onClick={handleAnalyzeText}>
                ✅ اعمل كود SQL للأسماء دي
              </button>
            </div>
          </div>
        </div>

        {showResults && (
          <div className="results-card show" id="results-card">
            <div className="results-head">
              <h3>📋 النتائج</h3>
              <div className="stat-pills">
                <div className="pill pill-green">{checkedCount} دفعوا</div>
                <div className="pill pill-gray">من {results.length}</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '340px', overflowY: 'auto' }}>
              <table className="names-table">
                <thead><tr><th>#</th><th>الاسم</th><th>الحالة</th></tr></thead>
                <tbody>
                  {results.map((n, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text3)', fontSize: '12px' }}>{i + 1}</td>
                      <td><strong>{n.name}</strong></td>
                      <td>
                        <span className={`status-badge ${n.checked ? 'status-checked' : 'status-unchecked'}`}>
                          {n.checked ? '✓ دفع' : '— لم يدفع'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sql-section">
              <div className="sql-section-head">
                <h4>💻 كود SQL — انسخه وشغله في Access</h4>
                <button className="btn-copy" onClick={copySQL}><Copy size={14} /> نسخ الكود</button>
              </div>
              <div className="sql-box">{computedSqlOutput}</div>
            </div>
          </div>
        )}

        <div className="instructions">
          <h3>📖 طريقة الاستخدام في Access</h3>
          <div className="steps">
            <div className="step"><div className="step-num">1</div><p>افتح <strong>Microsoft Access</strong> وافتح قاعدة بياناتك</p></div>
            <div className="step"><div className="step-num">2</div><p>اضغط على <strong>إنشاء</strong> في الشريط العلوي ← <strong>تصميم الاستعلام</strong></p></div>
            <div className="step"><div className="step-num">3</div><p><strong>أغلق</strong> نافذة إضافة الجداول اللي بتظهر</p></div>
            <div className="step"><div className="step-num">4</div><p>في الشريط العلوي اضغط على زر <code>SQL</code> أو <code>عرض SQL</code></p></div>
            <div className="step"><div className="step-num">5</div><p><strong>امسح</strong> الكود الموجود و<strong>الصق</strong> الكود اللي نسخته من هنا</p></div>
            <div className="step"><div className="step-num">6</div><p>اضغط <strong>تشغيل</strong> (أيقونة المثلث ▶) ← هيتعمل العلامة على كل الأسماء دفعة واحدة! 🎉</p></div>
          </div>
        </div>


      </div>
    </>
  );
}
