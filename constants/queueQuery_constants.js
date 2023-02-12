module.exports = {
    SKU_IMPORT: `SELECT DISTINCT 
    ChildProduct.id as sku_code, ChildProduct.notable_updates, AppProduct.id as parent_id, AppProduct.product_classification_id as sku_cf_id, AppProduct.product_name as sku_name, AppProduct.has_valid_main_image_url as sku_image, AppProduct.short_desc as sku_desc, (SELECT GROUP_CONCAT(CONCAT(product_shippable_setup_attribute_type_id, '::', value_varchar)) FROM product_shippable_to_attribute_type_values WHERE product_id = ChildProduct.id) AS sku_attributes, Color.value_varchar AS sku_color, Size.value_varchar AS sku_frame_size
  FROM products AS ChildProduct 
  INNER JOIN products AS AppProduct
    ON AppProduct.id = ChildProduct.grouping_product_id 
    INNER JOIN product_shippable_to_attribute_type_values AS Color
    ON Color.product_id = ChildProduct.id AND Color.product_shippable_setup_attribute_type_id = 8
  INNER JOIN product_shippable_to_attribute_type_values AS Size
    ON Size.product_id = ChildProduct.id AND Size.product_shippable_setup_attribute_type_id = 9 
    WHERE 
    ChildProduct.notable_updates > DATE_SUB(NOW(),INTERVAL 2 DAY) 
        ORDER BY ChildProduct.id ASC`,    
    PRICE_IMPORT: `SELECT DISTINCT ListPrice.product_id as sku_code, ListPrice.price AS sku_list_price, SellPrice.price AS sku_sell_price
    FROM product_prices AS ListPrice
    INNER JOIN product_prices AS SellPrice
        ON SellPrice.product_id = ListPrice.product_id 
    WHERE 
        ListPrice.price_type_id = 1
        AND ListPrice.is_deleted = 0
        AND SellPrice.price_type_id = 2
        AND SellPrice.is_deleted = 0 
        AND ListPrice.created > DATE_SUB(NOW(),INTERVAL 30 DAY) 
        ORDER BY ListPrice.product_id ASC`,
    STOCK_IMPORT: `....`
}