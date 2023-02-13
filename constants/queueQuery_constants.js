const importInterval = 'DATE_SUB(NOW(),INTERVAL 50 DAY)';
module.exports = {
    SKU_IMPORT: `SELECT DISTINCT 
    ChildProduct.id as sku_code, ChildProduct.notable_updates, AppProduct.id as parent_id, AppProduct.product_classification_id as sku_cf_id, AppProduct.product_name as sku_name, AppProduct.has_valid_main_image_url as sku_image, AppProduct.short_desc as sku_desc, (SELECT GROUP_CONCAT(CONCAT(product_shippable_setup_attribute_type_id, '::', value_varchar)) FROM product_shippable_to_attribute_type_values WHERE product_id = ChildProduct.id) AS sku_attributes, Color.value_varchar AS sku_color, Size.value_varchar AS sku_frame_size
  FROM products AS ChildProduct 
  INNER JOIN products AS AppProduct
    ON AppProduct.id = ChildProduct.grouping_product_id 
    LEFT JOIN product_shippable_to_attribute_type_values AS Color
    ON Color.product_id = ChildProduct.id AND Color.product_shippable_setup_attribute_type_id = 8
  LEFT JOIN product_shippable_to_attribute_type_values AS Size
    ON Size.product_id = ChildProduct.id AND Size.product_shippable_setup_attribute_type_id = 9 
    WHERE 
    ChildProduct.notable_updates > ${importInterval} 
        ORDER BY ChildProduct.id ASC`,    
    REGULAR_PRICE_IMPORT: `SELECT DISTINCT ListPrice.product_id as sku_code, ListPrice.price AS sku_list_price, SellPrice.price AS sku_sell_price
    FROM product_prices AS ListPrice
    INNER JOIN product_prices AS SellPrice
        ON SellPrice.product_id = ListPrice.product_id 
    WHERE 
        ListPrice.price_type_id = 1
        AND ListPrice.is_deleted = 0
        AND SellPrice.price_type_id = 2
        AND SellPrice.is_deleted = 0 
        AND ListPrice.created > ${importInterval} 
        ORDER BY ListPrice.product_id ASC`,
    STOCK_IMPORT: `SELECT DISTINCT ChildProduct.id, Stock.product_id as sku_code, Stock.total_qty as sku_stock, Availability.cl_stock_location_id 
    FROM products AS ChildProduct 
    INNER JOIN products AS AppProduct
      ON AppProduct.id = ChildProduct.grouping_product_id
    LEFT JOIN product_shipping_availability_types AS Availability
      ON (Availability.id = ChildProduct.product_shipping_availability_type_id) 
  LEFT JOIN product_inventory_totals AS Stock
      ON (Stock.product_id = ChildProduct.id AND Stock.product_inventory_location_id IS NULL)
    WHERE 
      AppProduct.is_deleted = '0' 
      AND AppProduct.seller_account_id IS NULL 
      AND AppProduct.is_demo = '0' 
      AND AppProduct.is_enabled = '1' 
      AND AppProduct.is_approved = '1' 
      AND AppProduct.grouping_product_id IS NULL 
      AND AppProduct.product_type_id = 2 
      AND AppProduct.has_valid_price_currency_id_1 = '1' 
      AND AppProduct.has_valid_image = '1' 
      AND AppProduct.product_name IS NOT NULL 
      AND AppProduct.product_name != ''  
      AND AppProduct.cached_is_site_ezcontacts = '1' 
      AND AppProduct.cached_has_valid_manufacturer = '1' 
      AND AppProduct.is_show_browse = '1' 
      AND AppProduct.is_hidden_visibility = '0' 
      AND AppProduct.product_classification_id IS NOT NULL 
      AND ChildProduct.is_deleted = 0
      AND ChildProduct.is_demo = 0
      AND ChildProduct.is_enabled = 1
      AND ChildProduct.is_approved = 1
      AND ChildProduct.has_valid_price_currency_id_1 = 1
      AND ChildProduct.has_valid_image = 1
  AND Stock.product_inventory_location_id IS NULL 
  AND Availability.cl_stock_location_id IS NOT NULL
  AND Stock.modified > ${importInterval}`
}