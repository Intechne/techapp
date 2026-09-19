export const SITE = {
  origin: 'https://techapp.intechne.com.tr',
  name: 'TechApp',
  tagline: 'Bir fikrin varsa, bir yerin var.',
  description: 'Teknoloji, girişimcilik, robotik ve sosyal etki alanlarında etkinlikleri keşfet, takımlara katıl, üret ve yaptıklarını görünür kıl. TechApp, Intechne’nin gençler için geliştirdiği platformdur.',
  appScheme: 'techapp://',
  stores: {
    ios: process.env.NEXT_PUBLIC_APP_STORE_URL || null,
    android: process.env.NEXT_PUBLIC_PLAY_STORE_URL || null,
    huawei: process.env.NEXT_PUBLIC_APPGALLERY_URL || null,
  },
} as const;

/**
 * Public backend coordinates. Both values are PUBLIC by design (the publishable key ships inside the mobile app and every
 * page of this site; Row Level Security decides what it may do). Environment variables override them, e.g. to point a
 * preview deployment at another Supabase project. A secret / service_role key must never be placed here.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pacvhcnawtnkauvguoaw.supabase.co';
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_MLarR9cY0rVgHR4MZG54-A_jfyk9E1A';
