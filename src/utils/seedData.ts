import { supabase } from '../lib/supabase';

export async function seedSampleBarData(adminUserId?: string) {
  try {
    // 1. Check or Insert Business Settings
    const { data: existingSettings } = await supabase.from('business_settings').select('id').limit(1);
    if (!existingSettings || existingSettings.length === 0) {
      await supabase.from('business_settings').insert({
        business_name: 'MUNAJ BAR',
        tagline: 'Premium Lounge & Luxury Nightlife',
        address: '14 Ahmadu Bello Way, Victoria Island, Lagos',
        phone: '+234 801 234 5678',
        email: 'management@munajbar.com',
        currency: 'NGN',
        low_stock_threshold_default: 5,
        receipt_header: 'VIP LOUNGE • MAIN BAR',
        receipt_footer: 'Thank you for partying with MUNAJ BAR! Please drink responsibly.',
        show_qr_on_receipt: false,
        show_worker_on_receipt: true,
        worker_pos_name: 'MUNAJ BAR',
        worker_pos_color: '#B7FF00',
      });
    }

    // 2. Categories
    const { data: existingCategories } = await supabase.from('categories').select('id').limit(1);
    let catBeersId = '';
    let catWhiskeyId = '';
    let catCognacId = '';
    let catEnergyId = '';
    let catWineId = '';

    if (!existingCategories || existingCategories.length === 0) {
      const { data: cats } = await supabase
        .from('categories')
        .insert([
          { name: 'Beers & Ciders', is_active: true },
          { name: 'Whiskey & Bourbons', is_active: true },
          { name: 'Cognac & Brandy', is_active: true },
          { name: 'Energy & Soft Drinks', is_active: true },
          { name: 'Champagne & Wines', is_active: true },
        ])
        .select();

      if (cats) {
        catBeersId = cats.find((c) => c.name === 'Beers & Ciders')?.id || '';
        catWhiskeyId = cats.find((c) => c.name === 'Whiskey & Bourbons')?.id || '';
        catCognacId = cats.find((c) => c.name === 'Cognac & Brandy')?.id || '';
        catEnergyId = cats.find((c) => c.name === 'Energy & Soft Drinks')?.id || '';
        catWineId = cats.find((c) => c.name === 'Champagne & Wines')?.id || '';
      }
    }

    // 3. Products
    const { data: existingProducts } = await supabase.from('products').select('id').limit(1);
    if (!existingProducts || existingProducts.length === 0) {
      const productsToInsert = [
        {
          name: 'Heineken Lager Beer 330ml',
          description: 'Premium Dutch imported malt lager',
          category_id: catBeersId || null,
          selling_price: 2500,
          cost_price: 1600,
          stock_quantity: 48,
          minimum_stock_level: 10,
          image_url: 'https://images.unsplash.com/photo-1608270191298-6e54c7d0d089?w=400&auto=format&fit=crop&q=80',
          is_active: true,
        },
        {
          name: 'Guinness Foreign Extra Stout 600ml',
          description: 'Rich roasted barley dark stout',
          category_id: catBeersId || null,
          selling_price: 3000,
          cost_price: 2000,
          stock_quantity: 36,
          minimum_stock_level: 8,
          image_url: 'https://images.unsplash.com/photo-1575037614876-c38a4d44f5b8?w=400&auto=format&fit=crop&q=80',
          is_active: true,
        },
        {
          name: 'Jameson Irish Whiskey Black Barrel 750ml',
          description: 'Triple distilled charred oak bourbon cask',
          category_id: catWhiskeyId || null,
          selling_price: 38000,
          cost_price: 27000,
          stock_quantity: 12,
          minimum_stock_level: 3,
          image_url: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=400&auto=format&fit=crop&q=80',
          is_active: true,
        },
        {
          name: 'Hennessy VSOP Cognac 700ml',
          description: 'Privilege blend of 60 eaux-de-vie',
          category_id: catCognacId || null,
          selling_price: 95000,
          cost_price: 72000,
          stock_quantity: 8,
          minimum_stock_level: 2,
          image_url: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&auto=format&fit=crop&q=80',
          is_active: true,
        },
        {
          name: 'Red Bull Energy Drink 250ml',
          description: 'Vitalizes body and mind',
          category_id: catEnergyId || null,
          selling_price: 2000,
          cost_price: 1300,
          stock_quantity: 60,
          minimum_stock_level: 12,
          image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop&q=80',
          is_active: true,
        },
        {
          name: 'Moët & Chandon Impérial Brut 750ml',
          description: 'Iconic vibrant champagne with bright fruitiness',
          category_id: catWineId || null,
          selling_price: 120000,
          cost_price: 88000,
          stock_quantity: 6,
          minimum_stock_level: 2,
          image_url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80',
          is_active: true,
        },
      ];

      await supabase.from('products').insert(productsToInsert);
    }

    // 4. Activity Log
    await supabase.from('activity_logs').insert({
      action: 'database_seeded',
      entity_type: 'system',
      description: 'Initial bar catalog, categories, and business parameters initialized',
    });

    return { success: true };
  } catch (err) {
    console.error('Error seeding data:', err);
    return { success: false, error: err };
  }
}
