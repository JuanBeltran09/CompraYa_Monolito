require('dotenv').config();
const { Pool } = require('pg');
const { faker } = require('@faker-js/faker');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 10000,
});

/**
 * Performs a bulk insert of records into a table.
 * If returningColumn is specified, it appends RETURNING and returns the mapped column values.
 * @param {Object} client PG client
 * @param {string} tableName Table to insert into
 * @param {Array<string>} columns Column names
 * @param {Array<Array>} rows Matrix of row values
 * @param {string|null} returningColumn Column to return (e.g. 'id')
 * @returns {Promise<Array>} Array of returned values (if returningColumn is provided)
 */
async function bulkInsert(client, tableName, columns, rows, returningColumn = null) {
  if (rows.length === 0) return [];
  
  const colNames = columns.join(', ');
  let queryText = `INSERT INTO ${tableName} (${colNames}) VALUES `;
  const valuesArray = [];
  let paramCounter = 1;
  const valuePlaceholders = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const placeholders = [];
    for (let j = 0; j < row.length; j++) {
      placeholders.push(`$${paramCounter++}`);
      valuesArray.push(row[j]);
    }
    valuePlaceholders.push(`(${placeholders.join(', ')})`);
  }

  queryText += valuePlaceholders.join(', ');
  
  if (returningColumn) {
    queryText += ` RETURNING ${returningColumn}`;
    const res = await client.query(queryText, valuesArray);
    return res.rows.map(r => r[returningColumn]);
  } else {
    await client.query(queryText, valuesArray);
    return [];
  }
}

const fs = require('fs');
const path = require('path');

async function seed() {
  console.log('🚀 Iniciando siembra de base de datos CompraYa...');
  const startTotal = Date.now();
  
  const client = await pool.connect();
  try {
    // 0. Crear tablas si no existen ejecutando el esquema SQL
    console.log('🏗️ Inicializando esquema de base de datos...');
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('✅ Esquema inicializado.');

    await client.query('BEGIN');

    // 1. Limpiar tablas existentes para asegurar que se pueda re-ejecutar sin duplicados
    console.log('🧹 Limpiando tablas existentes...');
    await client.query('TRUNCATE TABLE pagos, items_pedido, pedidos, carrito, sesiones, usuarios, productos, categorias CASCADE');

    // 2. Insertar categorías (10 principales)
    console.log('📁 Insertando categorías...');
    const categoriasBase = [
      { nombre: 'Tecnología y Electrónica', descripcion: 'Celulares, computadores, televisores y gadgets.' },
      { nombre: 'Ropa y Moda', descripcion: 'Prendas de vestir, zapatos y accesorios para todos.' },
      { nombre: 'Hogar y Cocina', descripcion: 'Muebles, electrodomésticos y decoración.' },
      { nombre: 'Deportes y Fitness', descripcion: 'Equipos deportivos, suplementos y ropa activa.' },
      { nombre: 'Juguetes y Bebés', descripcion: 'Diversión para niños y cuidado de bebés.' },
      { nombre: 'Libros y Papelería', descripcion: 'Lecturas, material escolar y oficina.' },
      { nombre: 'Belleza y Cuidado Personal', descripcion: 'Cosméticos, perfumes y cuidado corporal.' },
      { nombre: 'Herramientas y Automotriz', descripcion: 'Ferretería, refacciones y equipamiento.' },
      { nombre: 'Supermercado', descripcion: 'Alimentos, bebidas y despensa diaria.' },
      { nombre: 'Mascotas', descripcion: 'Alimento, juguetes y accesorios para mascotas.' }
    ];

    const categoryIds = [];
    for (const cat of categoriasBase) {
      const res = await client.query(
        'INSERT INTO categorias (nombre, descripcion) VALUES ($1, $2) RETURNING id',
        [cat.nombre, cat.descripcion]
      );
      categoryIds.push(res.rows[0].id);
    }
    console.log(`✅ ${categoryIds.length} categorías creadas.`);

    // 3. Insertar 500,000 productos en lotes
    console.log('📦 Generando y cargando 500,000 productos (lotes de 5,000)...');
    const productBatchSize = 5000;
    const totalProducts = 500000;
    
    // Guardamos una muestra en memoria para usar en pedidos y evitar lecturas a la base de datos
    const sampleProducts = [];
    const maxSampleProducts = 10000; // tamaño ideal de muestra en memoria

    const productColumns = ['sku', 'nombre', 'descripcion', 'categoria_id', 'precio_base', 'atributos', 'stock_total', 'imagen_url'];

    for (let i = 0; i < totalProducts; i += productBatchSize) {
      const productRows = [];
      const currentBatchCount = Math.min(productBatchSize, totalProducts - i);

      for (let j = 0; j < currentBatchCount; j++) {
        const globalIndex = i + j;
        const sku = `PROD-${faker.string.alphanumeric(8).toUpperCase()}-${globalIndex}`;
        const nombre = faker.commerce.productName();
        const precio_base = parseFloat(faker.commerce.price({ min: 10000, max: 8000000, dec: 0 })); // COP
        const stock_total = faker.number.int({ min: 5, max: 500 });
        const categoria_id = faker.helpers.arrayElement(categoryIds);
        
        const atributos = {
          marca: faker.company.name(),
          peso: `${faker.number.int({ min: 1, max: 20 })} kg`,
          ...(globalIndex % 3 === 0 && { procesador: faker.helpers.arrayElement(['Intel i7', 'AMD Ryzen 5', 'Apple M2']) }),
          ...(globalIndex % 5 === 0 && { talla: faker.helpers.arrayElement(['S', 'M', 'L', 'XL']) }),
          ...(globalIndex % 4 === 0 && { color: faker.color.human() }),
        };

        const descripcion = `${faker.commerce.productDescription()}. Fabricado con los más altos estándares de calidad. SKU: ${sku}`;
        const imagen_url = `https://picsum.photos/seed/${sku}/400/300`;

        productRows.push([
          sku,
          nombre,
          descripcion,
          categoria_id,
          precio_base,
          JSON.stringify(atributos),
          stock_total,
          imagen_url
        ]);

        // Poblar muestra de productos en memoria para pedidos
        if (sampleProducts.length < maxSampleProducts) {
          sampleProducts.push({
            sku,
            nombre,
            precio_base
          });
        }
      }

      await bulkInsert(client, 'productos', productColumns, productRows);
      
      if ((i + productBatchSize) % 50000 === 0) {
        console.log(`   👉 ${i + productBatchSize} productos insertados...`);
      }
    }
    console.log('✅ 500,000 productos cargados exitosamente.');

    // 4. Insertar 5,000 usuarios en lotes
    console.log('👤 Generando y cargando 5,000 usuarios...');
    const userBatchSize = 1000;
    const totalUsers = 5000;
    const userColumns = ['email', 'password_hash', 'nombre_completo', 'pais', 'direccion'];
    
    // Guardamos los IDs de usuarios retornados para los pedidos
    let userIds = [];

    for (let i = 0; i < totalUsers; i += userBatchSize) {
      const userRows = [];
      const currentBatchCount = Math.min(userBatchSize, totalUsers - i);

      for (let j = 0; j < currentBatchCount; j++) {
        const globalIndex = i + j;
        const email = `usuario${globalIndex}@compraya.com`; // emails predecibles para pruebas de login, o faker
        const password_hash = '$2a$10$tZ2R8/3vM5aVscXkoxDTe.7YyS2eH3b/YV6v7.07e/0XG0n3Wly8m'; // hash de 'admin123'
        const nombre_completo = faker.person.fullName();
        const pais = 'Colombia';
        const direccion = {
          ciudad: faker.helpers.arrayElement(['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga']),
          nomenclatura: faker.location.streetAddress(),
          codigo_postal: faker.location.zipCode()
        };

        userRows.push([
          email,
          password_hash,
          nombre_completo,
          pais,
          JSON.stringify(direccion)
        ]);
      }

      const batchIds = await bulkInsert(client, 'usuarios', userColumns, userRows, 'id');
      userIds = userIds.concat(batchIds);
    }
    console.log(`✅ ${userIds.length} usuarios cargados exitosamente (Contraseña demo: "admin123").`);

    // 5. Insertar 100,000 pedidos, items_pedido y pagos en lotes
    console.log('🛒 Generando y cargando 100,000 pedidos, detalles y pagos (lotes de 5,000)...');
    const orderBatchSize = 5000;
    const totalOrders = 100000;

    const orderColumns = ['usuario_id', 'estado', 'total', 'moneda', 'direccion_entrega'];
    const itemColumns = ['pedido_id', 'producto_sku', 'nombre_producto', 'cantidad', 'precio_unitario'];
    const paymentColumns = ['pedido_id', 'metodo', 'estado', 'referencia', 'monto'];

    for (let i = 0; i < totalOrders; i += orderBatchSize) {
      const orderRows = [];
      const orderItemsGroup = []; // Agrupador temporal de items por orden
      const orderPaymentsGroup = []; // Agrupador temporal de pagos por orden
      
      const currentBatchCount = Math.min(orderBatchSize, totalOrders - i);

      for (let j = 0; j < currentBatchCount; j++) {
        const usuario_id = faker.helpers.arrayElement(userIds);
        const estado = faker.helpers.arrayElement(['pagado', 'enviado', 'entregado', 'pendiente', 'cancelado']);
        
        // Items del pedido (1 a 4 items por pedido)
        const numItems = faker.number.int({ min: 1, max: 4 });
        const items = [];
        let orderTotal = 0;

        for (let k = 0; k < numItems; k++) {
          const prod = faker.helpers.arrayElement(sampleProducts);
          const cantidad = faker.number.int({ min: 1, max: 3 });
          const precio_unitario = prod.precio_base;
          orderTotal += precio_unitario * cantidad;
          
          items.push({
            sku: prod.sku,
            nombre: prod.nombre,
            cantidad,
            precio_unitario
          });
        }

        const direccion_entrega = {
          direccion: faker.location.streetAddress(),
          ciudad: faker.helpers.arrayElement(['Bogotá', 'Medellín', 'Cali', 'Barranquilla'])
        };

        orderRows.push([
          usuario_id,
          estado,
          orderTotal,
          'COP',
          JSON.stringify(direccion_entrega)
        ]);

        orderItemsGroup.push(items);
        
        // Pago asociado
        const metodoPago = faker.helpers.arrayElement(['tarjeta', 'PSE', 'efectivo']);
        const estadoPago = estado === 'cancelado' ? 'rechazado' : (estado === 'pendiente' ? 'pendiente' : 'aprobado');
        const referencia = `PAY-${faker.string.alphanumeric(10).toUpperCase()}`;

        orderPaymentsGroup.push({
          metodo: metodoPago,
          estado: estadoPago,
          referencia,
          monto: orderTotal
        });
      }

      // Insertar pedidos y capturar sus IDs autogenerados
      const orderIds = await bulkInsert(client, 'pedidos', orderColumns, orderRows, 'id');

      // Preparar bulk para items de pedido y pagos con sus respectivos IDs de pedido
      const itemRowsToInsert = [];
      const paymentRowsToInsert = [];

      for (let j = 0; j < orderIds.length; j++) {
        const pedidoId = orderIds[j];
        
        // Poblar items con el pedido_id real
        const items = orderItemsGroup[j];
        for (const item of items) {
          itemRowsToInsert.push([
            pedidoId,
            item.sku,
            item.nombre,
            item.cantidad,
            item.precio_unitario
          ]);
        }

        // Poblar pagos con el pedido_id real
        const payment = orderPaymentsGroup[j];
        paymentRowsToInsert.push([
          pedidoId,
          payment.metodo,
          payment.estado,
          payment.referencia,
          payment.monto
        ]);
      }

      // Realizar inserciones masivas de items y pagos
      await bulkInsert(client, 'items_pedido', itemColumns, itemRowsToInsert);
      await bulkInsert(client, 'pagos', paymentColumns, paymentRowsToInsert);

      if ((i + orderBatchSize) % 20000 === 0) {
        console.log(`   👉 ${i + orderBatchSize} pedidos insertados con sus ítems y pagos...`);
      }
    }
    console.log('✅ 100,000 pedidos, ítems y pagos cargados exitosamente.');

    await client.query('COMMIT');
    const endTotal = Date.now();
    const durationSec = ((endTotal - startTotal) / 1000).toFixed(2);
    console.log(`\n🎉 ¡Siembra completada con éxito!`);
    console.log(`⏱️  Tiempo total de ejecución: ${durationSec} segundos.`);
    console.log(`📊 Total Registros Creados:`);
    console.log(`   - Categorías: ${categoryIds.length}`);
    console.log(`   - Productos: ${totalProducts}`);
    console.log(`   - Usuarios: ${totalUsers}`);
    console.log(`   - Pedidos: ${totalOrders}`);
    console.log(`   - Ítems de Pedidos: ~${totalOrders * 2.5}`);
    console.log(`   - Pagos: ${totalOrders}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error fatal durante la siembra, transacción abortada:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
