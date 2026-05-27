import React, { useState, useEffect } from 'react';
import {
  getInvoiceSettings, saveInvoiceSettings, DEFAULT_INVOICE_SETTINGS
} from '../firebase/firestore';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import {
  Settings, Save, RefreshCw, Eye, Building2, Phone, Mail,
  Globe, MessageSquare, Palette, Image, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type Settings = typeof DEFAULT_INVOICE_SETTINGS;

const COLORS = [
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Rose', value: '#e11d48' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Slate', value: '#334155' },
  { label: 'Black', value: '#111111' },
];

const InvoiceSettings: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_INVOICE_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { isAdmin } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin()) { navigate('/dashboard'); return; }
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getInvoiceSettings();
      setSettings(data as Settings);
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveInvoiceSettings(settings);
      toast.success('Invoice settings saved successfully!');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_INVOICE_SETTINGS });
    toast.success('Reset to default settings');
  };

  const set = (key: keyof Settings, value: any) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const previewHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:72mm; margin:0 auto; padding:4mm 2mm; font-family:'Courier New',monospace; font-size:11px; color:#111; }
  .center { text-align:center; }
  .name { font-size:16px; font-weight:900; color:${settings.primaryColor}; text-transform:uppercase; letter-spacing:1px; }
  .tagline { font-size:9px; color:#555; margin-top:1mm; }
  .contact { font-size:9px; color:#444; margin-top:1mm; line-height:1.5; }
  hr { border:none; border-top:1px dashed #999; margin:2mm 0; }
  .solid { border-top:1px solid #333; }
  .row { display:flex; justify-content:space-between; margin:1px 0; }
  .lbl { color:#555; }
  .val { font-weight:700; }
  table { width:100%; border-collapse:collapse; }
  thead th { font-size:9px; padding:2px 0; text-align:left; color:#444; text-transform:uppercase; border-bottom:1px solid #333; }
  thead th:nth-child(2){ text-align:center; }
  thead th:nth-child(3),thead th:nth-child(4){ text-align:right; }
  td { font-size:10px; padding:2px 0; }
  .total { font-size:13px; font-weight:900; color:${settings.primaryColor}; }
  .thank { text-align:center; font-size:12px; font-weight:700; color:${settings.primaryColor}; margin:4mm 0 2mm; }
  .policy { text-align:center; font-size:8px; color:#666; }
  .footer { text-align:center; font-size:8px; color:#999; margin-top:3mm; }
  .badge { display:inline-block; background:${settings.primaryColor}; color:#fff; font-size:9px; padding:1px 5px; border-radius:10px; font-weight:700; }
</style>
</head>
<body>
  <div class="center" style="padding:4mm 0 2mm;">
    ${settings.logoUrl ? `<img src="${settings.logoUrl}" style="width:28mm;height:auto;margin-bottom:2mm;" onerror="this.style.display='none'">` : ''}
    <div class="name">${settings.businessName}</div>
    ${settings.tagline ? `<div class="tagline">${settings.tagline}</div>` : ''}
    <div class="contact">
      ${settings.address ? settings.address + '<br>' : ''}
      ${settings.phone ? '📞 ' + settings.phone : ''}
      ${settings.email ? ' | ✉ ' + settings.email : ''}
    </div>
  </div>
  <hr class="solid">
  <div style="margin:1mm 0;">
    <div class="row"><span class="lbl">RECEIPT</span><span style="font-weight:700;color:${settings.primaryColor};">SZ-250527-0001</span></div>
    <div class="row"><span class="lbl">Date:</span><span>${format(new Date(), 'dd/MM/yyyy hh:mm a')}</span></div>
    <div class="row"><span class="lbl">Customer:</span><span class="val">Walk-in Customer</span></div>
    <div class="row"><span class="lbl">Cashier:</span><span style="background:#f0f0f0;padding:1px 4px;border-radius:4px;font-size:9px;">👤 Admin</span></div>
    <div class="row"><span class="lbl">Payment:</span><span class="badge">💵 CASH</span></div>
  </div>
  <hr>
  <table>
    <thead><tr><th style="width:42%">Item</th><th style="width:10%;text-align:center;">Qty</th><th style="width:22%;text-align:right;">Price</th><th style="width:26%;text-align:right;">Total</th></tr></thead>
    <tbody>
      <tr><td>Product A</td><td style="text-align:center;">2</td><td style="text-align:right;">Rs.1,500</td><td style="text-align:right;font-weight:600;">Rs.3,000</td></tr>
      <tr><td>Product B</td><td style="text-align:center;">1</td><td style="text-align:right;">Rs.2,200</td><td style="text-align:right;font-weight:600;">Rs.2,200</td></tr>
    </tbody>
    <tfoot>
      <tr><td colspan="3" style="text-align:right;color:#555;padding-top:2px;">Subtotal:</td><td style="text-align:right;padding-top:2px;">Rs.5,200</td></tr>
      <tr style="border-top:1px solid #333;border-bottom:1px solid #333;"><td colspan="3" style="text-align:right;font-size:13px;font-weight:900;">TOTAL:</td><td style="text-align:right;" class="total">Rs.5,200</td></tr>
      <tr><td colspan="3" style="text-align:right;color:#555;padding-top:2px;">Cash Received:</td><td style="text-align:right;padding-top:2px;">Rs.6,000</td></tr>
      <tr><td colspan="3" style="text-align:right;color:#059669;font-weight:700;">Change:</td><td style="text-align:right;color:#059669;font-weight:700;">Rs.800</td></tr>
    </tfoot>
  </table>
  <hr>
  <div class="thank">⭐ ${settings.thankYouMessage} ⭐</div>
  ${settings.returnPolicy ? `<div class="policy">${settings.returnPolicy}</div>` : ''}
  <hr>
  <div class="footer">${settings.footerNote}</div>
</body>
</html>`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Settings className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Invoice Settings</h1>
            <p className="text-gray-500 text-sm">Customize your 80mm thermal receipt</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors font-medium"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Hide Preview' : 'Live Preview'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-60"
          >
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${showPreview ? 'grid-cols-[1fr_320px]' : 'grid-cols-1'}`}>
        {/* Settings Form */}
        <div className="space-y-5">
          {/* Business Info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-800">Business Information</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Name *</label>
                <input
                  value={settings.businessName}
                  onChange={e => set('businessName', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="Your business name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tagline</label>
                <input
                  value={settings.tagline}
                  onChange={e => set('tagline', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="Your business tagline"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                <input
                  value={settings.address}
                  onChange={e => set('address', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="Full business address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone</label>
                <input
                  value={settings.phone}
                  onChange={e => set('phone', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="+94 77 000 0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</label>
                <input
                  value={settings.email}
                  onChange={e => set('email', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="info@business.com"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> Website</label>
                <input
                  value={settings.website}
                  onChange={e => set('website', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="www.business.com"
                />
              </div>
            </div>
          </div>

          {/* Logo & Appearance */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-800">Appearance & Branding</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1"><Image className="w-3.5 h-3.5" /> Logo URL</label>
                <input
                  value={settings.logoUrl}
                  onChange={e => set('logoUrl', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="https://your-site.com/logo.png"
                />
                {settings.logoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={settings.logoUrl} alt="Logo preview" className="h-12 rounded-lg object-contain border border-gray-100" onError={e => (e.currentTarget.style.display='none')} />
                    <span className="text-xs text-gray-400">Logo preview</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => set('primaryColor', c.value)}
                      title={c.label}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${settings.primaryColor === c.value ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                  <label className="relative cursor-pointer">
                    <input type="color" value={settings.primaryColor} onChange={e => set('primaryColor', e.target.value)} className="sr-only" />
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 text-xs">+</div>
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Selected: <span className="font-mono" style={{ color: settings.primaryColor }}>{settings.primaryColor}</span></p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => set('showLogo', !settings.showLogo)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${settings.showLogo ? 'bg-indigo-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.showLogo ? 'translate-x-5' : ''}`} />
                </button>
                <label className="text-sm text-gray-700">Show logo on receipt</label>
              </div>
            </div>
          </div>

          {/* Receipt Content */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-800">Receipt Content</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Thank You Message</label>
                <input
                  value={settings.thankYouMessage}
                  onChange={e => set('thankYouMessage', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="Thank you for shopping with us!"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Return Policy</label>
                <textarea
                  value={settings.returnPolicy}
                  onChange={e => set('returnPolicy', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                  placeholder="Returns accepted within 7 days with receipt."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Footer Note</label>
                <input
                  value={settings.footerNote}
                  onChange={e => set('footerNote', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="Powered by SmartZone POS"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Panel */}
        {showPreview && (
          <div className="sticky top-0 h-fit">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-gray-800 text-sm">80mm Receipt Preview</span>
              </div>
              <div className="p-4 bg-gray-50">
                <div className="mx-auto bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
                  style={{ width: '284px', fontFamily: 'monospace' }}>
                  <iframe
                    srcDoc={previewHtml}
                    style={{ width: '100%', height: '520px', border: 'none' }}
                    title="Receipt Preview"
                  />
                </div>
                <p className="text-center text-xs text-gray-400 mt-2">📄 Preview at 80mm scale</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save notification */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-xl shadow-indigo-300 disabled:opacity-60"
        >
          {saving
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Saving...</>
            : <><Save className="w-4 h-4" /> Save Receipt Settings</>
          }
        </button>
      </div>
    </div>
  );
};

export default InvoiceSettings;
