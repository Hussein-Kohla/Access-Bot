import React, { useState } from 'react';
import { Edit3, Copy } from 'lucide-react';
import './index.css';

interface NameResult {
  name: string;
  checked: boolean;
}

export default function App() {
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastShow, setToastShow] = useState<boolean>(false);
  
  const [tableName, setTableName] = useState<string>('Table1');
  const [nameField, setNameField] = useState<string>('الاسم');
  const [checkField, setCheckField] = useState<string>('م ط');
  const [updateValue, setUpdateValue] = useState<boolean>(true);
  
  const [namesInput, setNamesInput] = useState<string>('');
  
  const [results, setResults] = useState<NameResult[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 2800);
  };
  
  const handleAnalyzeText = () => {
    if (!namesInput.trim()) { showToast('اكتب الأسماء أولاً'); return; }
    const names = namesInput.split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0 && n !== nameField && n !== 'الاسم')
      .map(n => ({ name: n, checked: updateValue }));
    displayResults(names);
  };
  
  const displayResults = (names: NameResult[]) => {
    setResults(names);
    setShowResults(true);
    setTimeout(() => {
      document.getElementById('results-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  let computedSqlOutput = '-- لم يتم التعرف على أسماء';
  
  if (results.length > 0) {
    computedSqlOutput = '';
    const trueNames = results.filter(n => n.checked).map(n => n.name);
    const falseNames = results.filter(n => !n.checked).map(n => n.name);

    if (trueNames.length > 0) {
      const inList = trueNames.map(n => '"' + n.replace(/"/g, '""') + '"').join(', ');
      computedSqlOutput += `UPDATE [${tableName || 'Table1'}]\nSET [${checkField || 'م ط'}] = True\nWHERE [${nameField || 'الاسم'}] IN (${inList});\n\n`;
    }
    if (falseNames.length > 0) {
      const inList = falseNames.map(n => '"' + n.replace(/"/g, '""') + '"').join(', ');
      computedSqlOutput += `UPDATE [${tableName || 'Table1'}]\nSET [${checkField || 'م ط'}] = False\nWHERE [${nameField || 'الاسم'}] IN (${inList});\n`;
    }
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
      <div className={`toast ${toastShow ? 'show' : ''}`}>{toastMsg}</div>

      <div className="header">
        <div className="header-inner">
          <div className="logo">
            <img src="/logo.png" alt="DataSync AI Logo" className="logo-icon-img" style={{width: 36, height: 36, objectFit: 'cover', borderRadius: '10px'}} />
            <div className="logo-text">
              <h1>DataSync AI</h1>
              <p>مُزامن البيانات الذكي لـ Access</p>
            </div>
          </div>
        </div>
      </div>

      <div className="main">
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

        <div className="grid" style={{ gridTemplateColumns: '1fr', maxWidth: '600px', margin: '0 auto' }}>
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
                {results.map((item, index) => (
                  <tr key={index}>
                    <td style={{ color: 'var(--text3)', fontSize: '12px' }}>{index + 1}</td>
                    <td><strong>{item.name}</strong></td>
                    <td>
                      <span className={`status-badge ${item.checked ? 'status-checked' : 'status-unchecked'}`}>
                        {item.checked ? '✓ دفع' : '— لم يدفع'}
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
            <div className="step">
              <div className="step-num">1</div>
              <div className="step-content">
                <p>📂 افتح <strong>Microsoft Access</strong> وافتح قاعدة بياناتك</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <div className="step-content">
                <p>➕ اضغط على <strong>إنشاء</strong> في الشريط العلوي ← <strong>تصميم الاستعلام</strong></p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <div className="step-content">
                <p>🖱️ <strong>حدد اسم الملف "خليفة"</strong> ثم اضغط علامة الـ ❌</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">4</div>
              <div className="step-content">
                <p>💻 في الشريط السفلي شمال اضغط على زر <code>SQL</code> أو <code>عرض SQL</code></p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">5</div>
              <div className="step-content">
                <p>📋 <strong>امسح</strong> الكود الموجود و<strong>الصق</strong> الكود اللي نسخته من هنا</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">6</div>
              <div className="step-content">
                <p>⚡ اضغط <strong>تشغيل</strong> (علامة التعجب ❗️) ← هيتعمل العلامة على كل الأسماء دفعة واحدة! 🎉</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
