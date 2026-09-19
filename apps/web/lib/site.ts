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

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
