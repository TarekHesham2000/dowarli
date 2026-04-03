import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'سياسة الخصوصية - أجرلي',
  description: 'سياسة الخصوصية وحماية البيانات لمنصة أجرلي للإيجار العقاري في مصر',
}

export default function PrivacyPage() {
  return (
    <div className='min-h-screen bg-gray-50' dir='rtl'>
      {/* Header */}
      <nav className='bg-white border-b px-4 py-4 flex items-center justify-between'>
        <a href='/' className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center'>
            <svg viewBox='0 0 24 24' fill='white' className='w-4 h-4'>
              <path d='M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'/>
              <polyline points='9,22 9,12 15,12 15,22' fill='none' stroke='white' strokeWidth='1.5'/>
            </svg>
          </div>
          <span className='font-bold text-green-800 text-lg'>أجرلي</span>
        </a>
        <a href='/' className='text-sm text-green-700 hover:underline'>العودة للرئيسية</a>
      </nav>

      <div className='max-w-3xl mx-auto px-4 py-10'>
        <div className='bg-white rounded-2xl shadow-sm p-6 sm:p-10'>
          <h1 className='text-2xl sm:text-3xl font-black text-gray-900 mb-2'>سياسة الخصوصية</h1>
          <p className='text-gray-500 text-sm mb-8'>آخر تحديث: يناير 2025</p>

          <div className='space-y-8 text-gray-700 leading-relaxed'>

            <section>
              <h2 className='text-lg font-bold text-gray-900 mb-3'>١. مقدمة</h2>
              <p className='text-sm leading-7'>
                نرحب بكم في منصة <strong>أجرلي</strong>، المنصة المتخصصة في الإيجار العقاري في مصر. نحن نأخذ خصوصية مستخدمينا بجدية تامة، وتوضح هذه السياسة كيفية جمع بياناتكم واستخدامها وحمايتها عند استخدام خدماتنا.
              </p>
            </section>

            <section>
              <h2 className='text-lg font-bold text-gray-900 mb-3'>٢. البيانات التي نجمعها</h2>
              <p className='text-sm leading-7 mb-3'>نقوم بجمع الأنواع التالية من البيانات:</p>
              <ul className='text-sm space-y-2 list-none'>
                {[
                  { icon: '👤', text: 'بيانات التسجيل: الاسم، رقم الهاتف، البريد الإلكتروني' },
                  { icon: '🏠', text: 'بيانات الإعلانات: معلومات العقار، الصور، الأسعار، العناوين' },
                  { icon: '💳', text: 'بيانات المالية: معاملات المحفظة وصور الإيصالات' },
                  { icon: '📱', text: 'بيانات الاستخدام: سجلات الدخول، الأنشطة على المنصة' },
                ].map((item, i) => (
                  <li key={i} className='flex items-start gap-3 bg-gray-50 rounded-xl p-3'>
                    <span className='text-lg flex-shrink-0'>{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className='text-lg font-bold text-gray-900 mb-3'>٣. كيف نستخدم بياناتكم</h2>
              <ul className='text-sm space-y-2'>
                {[
                  'تفعيل حسابكم وتقديم الخدمات المطلوبة',
                  'مراجعة الإعلانات والتحقق منها قبل النشر',
                  'معالجة طلبات شحن المحفظة',
                  'التواصل معكم بشأن حسابكم أو الإعلانات',
                  'تحسين خدماتنا ومنصتنا',
                  'الامتثال للمتطلبات القانونية',
                ].map((item, i) => (
                  <li key={i} className='flex items-start gap-2 text-sm'>
                    <span className='text-green-600 mt-0.5 flex-shrink-0'>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className='text-lg font-bold text-gray-900 mb-3'>٤. مشاركة البيانات</h2>
              <p className='text-sm leading-7'>
                <strong>لا نبيع بياناتكم الشخصية لأي طرف ثالث.</strong> قد نشارك بعض البيانات مع:
              </p>
              <ul className='text-sm space-y-2 mt-3'>
                <li className='flex items-start gap-2'><span className='text-yellow-600 flex-shrink-0'>•</span><span>مزودي الخدمات التقنية (مثل Supabase للتخزين والمصادقة) المرتبطين باتفاقيات حماية البيانات</span></li>
                <li className='flex items-start gap-2'><span className='text-yellow-600 flex-shrink-0'>•</span><span>السلطات المختصة في حال الطلب القانوني</span></li>
              </ul>
            </section>

            <section>
              <h2 className='text-lg font-bold text-gray-900 mb-3'>٥. أمان البيانات</h2>
              <p className='text-sm leading-7'>
                نستخدم إجراءات أمنية معيارية في الصناعة لحماية بياناتكم، تشمل التشفير عند النقل (HTTPS/TLS) وتطبيق سياسات صلاحيات صارمة على مستوى قاعدة البيانات.
              </p>
            </section>

            <section>
              <h2 className='text-lg font-bold text-gray-900 mb-3'>٦. حقوقكم</h2>
              <ul className='text-sm space-y-2'>
                {[
                  'الوصول إلى بياناتكم الشخصية',
                  'تصحيح البيانات غير الصحيحة',
                  'طلب حذف حسابكم وبياناتكم',
                  'الاعتراض على معالجة بياناتكم',
                ].map((item, i) => (
                  <li key={i} className='flex items-start gap-2'>
                    <span className='text-green-600 flex-shrink-0'>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className='text-lg font-bold text-gray-900 mb-3'>٧. التواصل معنا</h2>
              <p className='text-sm leading-7'>
                لأي استفسارات تتعلق بسياسة الخصوصية أو بياناتكم، يرجى التواصل معنا عبر صفحة{' '}
                <a href='/contact' className='text-green-700 hover:underline font-medium'>تواصل معنا</a>.
              </p>
            </section>

          </div>
        </div>
      </div>

      <footer className='bg-green-900 text-green-100 py-6 px-4 text-center text-sm mt-10'>
        <p>© 2025 أجرلي — منصة الإيجار العقاري المصرية</p>
        <div className='flex justify-center gap-4 mt-2 text-xs opacity-70'>
          <a href='/privacy' className='hover:underline'>سياسة الخصوصية</a>
          <a href='/terms' className='hover:underline'>الشروط والأحكام</a>
          <a href='/about' className='hover:underline'>من نحن</a>
          <a href='/contact' className='hover:underline'>تواصل معنا</a>
        </div>
      </footer>
    </div>
  )
}
