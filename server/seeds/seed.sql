-- Seed BOM Items (15+ items)
INSERT INTO bom_items (part_number, part_name, description, category, manufacturer, unit_cost, quantity, total_cost, supplier, status) VALUES
('BOM-001', 'MCU STM32F407', 'ARM Cortex-M4 Microcontroller 168MHz', 'Semiconductors', 'STMicroelectronics', 8.50, 500, 4250.00, 'Digi-Key', 'active'),
('BOM-002', 'Capacitor 100uF', 'Electrolytic Capacitor 100uF 25V', 'Passive Components', 'Murata', 0.12, 2000, 240.00, 'Mouser', 'active'),
('BOM-003', 'Resistor 10K', 'SMD Resistor 10K Ohm 0402', 'Passive Components', 'Vishay', 0.02, 5000, 100.00, 'Arrow', 'active'),
('BOM-004', 'LED Red 3mm', 'High Brightness Red LED 3mm', 'Optoelectronics', 'Cree', 0.15, 1000, 150.00, 'Digi-Key', 'active'),
('BOM-005', 'PCB 4-Layer', '4-Layer PCB 100x80mm FR4', 'PCB', 'JLCPCB', 2.80, 500, 1400.00, 'JLCPCB Direct', 'active'),
('BOM-006', 'Connector USB-C', 'USB Type-C Receptacle 24-pin', 'Connectors', 'Amphenol', 1.25, 500, 625.00, 'Mouser', 'active'),
('BOM-007', 'Power IC LM7805', 'Voltage Regulator 5V 1.5A', 'Power Management', 'Texas Instruments', 0.85, 500, 425.00, 'Digi-Key', 'active'),
('BOM-008', 'Crystal 8MHz', 'Crystal Oscillator 8MHz HC49', 'Frequency Control', 'Abracon', 0.45, 500, 225.00, 'Arrow', 'active'),
('BOM-009', 'MOSFET IRF540', 'N-Channel MOSFET 100V 33A', 'Semiconductors', 'Infineon', 1.20, 300, 360.00, 'Digi-Key', 'active'),
('BOM-010', 'Inductor 10uH', 'SMD Power Inductor 10uH 2A', 'Passive Components', 'TDK', 0.35, 1000, 350.00, 'Mouser', 'active'),
('BOM-011', 'Op-Amp LM358', 'Dual Operational Amplifier', 'Semiconductors', 'Texas Instruments', 0.55, 400, 220.00, 'Arrow', 'active'),
('BOM-012', 'Diode 1N4007', 'Rectifier Diode 1A 1000V', 'Semiconductors', 'ON Semiconductor', 0.08, 2000, 160.00, 'Digi-Key', 'active'),
('BOM-013', 'Transformer 12V', 'PCB Mount Transformer 12V 2A', 'Power', 'Wurth Electronics', 4.50, 200, 900.00, 'Mouser', 'active'),
('BOM-014', 'Fuse 2A', 'SMD Fuse 2A 125V Fast Acting', 'Protection', 'Littelfuse', 0.30, 500, 150.00, 'Digi-Key', 'active'),
('BOM-015', 'Sensor BME280', 'Pressure/Temp/Humidity Sensor', 'Sensors', 'Bosch', 3.20, 300, 960.00, 'Mouser', 'active'),
('BOM-016', 'EEPROM 24C256', 'I2C EEPROM 256Kbit', 'Memory', 'Microchip', 0.75, 500, 375.00, 'Arrow', 'active'),
('BOM-017', 'Relay 5V', '5V SPDT Relay 10A', 'Electromechanical', 'Omron', 2.10, 200, 420.00, 'Digi-Key', 'active'),
('BOM-018', 'Header 2x10', 'Pin Header 2x10 2.54mm', 'Connectors', 'Samtec', 0.40, 500, 200.00, 'Mouser', 'active');

-- Seed Alternative Parts (15+ items)
INSERT INTO alternative_parts (original_part_id, alt_part_number, alt_part_name, alt_manufacturer, alt_unit_cost, alt_supplier, compatibility_score, cost_savings_percent, lead_time_days, notes, status) VALUES
(1, 'ALT-001A', 'MCU GD32F407', 'GigaDevice', 5.20, 'LCSC', 92.00, 38.82, 14, 'Pin-compatible alternative from GigaDevice', 'approved'),
(1, 'ALT-001B', 'MCU AT32F407', 'Artery', 6.00, 'LCSC', 88.00, 29.41, 21, 'Chinese STM32 clone with good compatibility', 'pending'),
(2, 'ALT-002A', 'Capacitor 100uF Samsung', 'Samsung Electro', 0.09, 'LCSC', 95.00, 25.00, 10, 'Samsung equivalent with better ESR', 'approved'),
(3, 'ALT-003A', 'Resistor 10K Yageo', 'Yageo', 0.015, 'LCSC', 98.00, 25.00, 7, 'Yageo equivalent, same specs', 'approved'),
(4, 'ALT-004A', 'LED Red Kingbright', 'Kingbright', 0.10, 'Mouser', 90.00, 33.33, 12, 'Slightly lower brightness but much cheaper', 'approved'),
(5, 'ALT-005A', 'PCB 4-Layer PCBWay', 'PCBWay', 2.20, 'PCBWay Direct', 96.00, 21.43, 10, 'Competitive pricing with similar quality', 'pending'),
(6, 'ALT-006A', 'Connector USB-C JAE', 'JAE Electronics', 0.95, 'Arrow', 94.00, 24.00, 18, 'Japanese quality alternative', 'approved'),
(7, 'ALT-007A', 'Power IC AMS1117-5.0', 'AMS', 0.35, 'LCSC', 85.00, 58.82, 8, 'LDO alternative, lower dropout', 'approved'),
(8, 'ALT-008A', 'Crystal 8MHz TXC', 'TXC Corporation', 0.30, 'Mouser', 97.00, 33.33, 10, 'Same specs, lower cost', 'approved'),
(9, 'ALT-009A', 'MOSFET IRFZ44N', 'Infineon', 0.90, 'Digi-Key', 88.00, 25.00, 5, 'Lower voltage rating but sufficient', 'pending'),
(10, 'ALT-010A', 'Inductor 10uH Bourns', 'Bourns', 0.28, 'Arrow', 93.00, 20.00, 12, 'Similar performance, lower cost', 'approved'),
(11, 'ALT-011A', 'Op-Amp MCP6002', 'Microchip', 0.40, 'Digi-Key', 90.00, 27.27, 7, 'Rail-to-rail output, better specs', 'approved'),
(12, 'ALT-012A', 'Diode 1N4148W', 'Nexperia', 0.05, 'LCSC', 82.00, 37.50, 5, 'SMD version, faster switching', 'pending'),
(13, 'ALT-013A', 'Transformer 12V Hahn', 'Hahn', 3.80, 'Mouser', 91.00, 15.56, 20, 'European manufacturer, UL listed', 'approved'),
(14, 'ALT-014A', 'Fuse 2A Bel', 'Bel Fuse', 0.22, 'Arrow', 96.00, 26.67, 8, 'Direct replacement', 'approved'),
(15, 'ALT-015A', 'Sensor BMP280', 'Bosch', 2.10, 'LCSC', 85.00, 34.38, 10, 'Pressure/temp only, no humidity', 'pending');

-- Seed Obsolescence Predictions (15+ items)
INSERT INTO obsolescence_predictions (bom_item_id, risk_level, predicted_eol_date, confidence_score, lifecycle_stage, last_buy_date, recommended_action, mitigation_strategy) VALUES
(1, 'low', '2030-06-15', 88.50, 'Active', NULL, 'Continue using, monitor lifecycle', 'Qualify GD32F407 as second source'),
(2, 'low', '2032-01-01', 95.00, 'Active', NULL, 'No action needed', 'Standard commodity component'),
(3, 'low', '2035-01-01', 97.00, 'Active', NULL, 'No action needed', 'Commodity part, always available'),
(4, 'medium', '2027-03-01', 72.00, 'Mature', '2026-12-01', 'Plan transition to newer LED technology', 'Evaluate Kingbright alternative'),
(5, 'low', '2030-12-31', 90.00, 'Active', NULL, 'No action needed', 'Multiple PCB vendors available'),
(6, 'low', '2033-01-01', 92.00, 'Active', NULL, 'No action needed', 'USB-C is current standard'),
(7, 'high', '2026-09-01', 85.00, 'End of Life', '2026-06-01', 'Immediate redesign required', 'Switch to AMS1117-5.0 or MP2315'),
(8, 'medium', '2028-06-01', 68.00, 'Mature', '2027-12-01', 'Source alternatives within 12 months', 'TXC Corporation crystal as backup'),
(9, 'low', '2029-12-01', 82.00, 'Active', NULL, 'Monitor supply chain', 'IRFZ44N as qualified alternative'),
(10, 'low', '2031-06-01', 90.00, 'Active', NULL, 'No action needed', 'Standard inductor value'),
(11, 'medium', '2027-06-01', 75.00, 'Mature', '2027-01-01', 'Evaluate MCP6002 replacement', 'Begin qualification of MCP6002'),
(12, 'low', '2034-01-01', 96.00, 'Active', NULL, 'No action needed', 'Widely available commodity'),
(13, 'high', '2026-06-15', 80.00, 'Last Time Buy', '2026-04-01', 'Place last time buy order immediately', 'Redesign with Hahn transformer'),
(14, 'low', '2031-01-01', 88.00, 'Active', NULL, 'No action needed', 'Multiple vendors available'),
(15, 'medium', '2028-01-01', 70.00, 'Mature', '2027-06-01', 'Plan migration to BME688', 'Bosch BME688 as next-gen replacement'),
(16, 'high', '2026-12-01', 78.00, 'End of Life', '2026-08-01', 'Source replacement EEPROM', 'Migrate to 24C512 or FRAM'),
(17, 'medium', '2028-06-01', 73.00, 'Mature', '2028-01-01', 'Monitor availability', 'Evaluate solid-state relay alternative');

-- Seed Lead Time Records (15+ items)
INSERT INTO lead_time_records (bom_item_id, supplier, standard_lead_time_days, current_lead_time_days, expedited_lead_time_days, last_order_date, next_delivery_date, reliability_score, trend, notes) VALUES
(1, 'Digi-Key', 14, 18, 5, '2026-02-15', '2026-03-05', 92.00, 'increasing', 'Slight delays due to semiconductor demand'),
(2, 'Mouser', 7, 7, 3, '2026-03-01', '2026-03-08', 98.00, 'stable', 'Consistent delivery times'),
(3, 'Arrow', 7, 5, 2, '2026-03-05', '2026-03-10', 97.00, 'decreasing', 'Improved logistics'),
(4, 'Digi-Key', 10, 12, 4, '2026-02-20', '2026-03-04', 90.00, 'increasing', 'Minor supply constraints'),
(5, 'JLCPCB Direct', 12, 14, 7, '2026-02-10', '2026-02-24', 88.00, 'increasing', 'Lunar New Year backlog'),
(6, 'Mouser', 14, 16, 5, '2026-02-25', '2026-03-13', 91.00, 'increasing', 'USB-C connector demand surge'),
(7, 'Digi-Key', 10, 25, 8, '2026-01-15', '2026-02-10', 75.00, 'increasing', 'EOL part - limited stock'),
(8, 'Arrow', 10, 10, 4, '2026-03-01', '2026-03-11', 95.00, 'stable', 'Regular restocking'),
(9, 'Digi-Key', 7, 8, 3, '2026-03-05', '2026-03-13', 94.00, 'stable', 'Good availability'),
(10, 'Mouser', 10, 10, 4, '2026-02-28', '2026-03-10', 96.00, 'stable', 'Consistent supply'),
(11, 'Arrow', 7, 9, 3, '2026-03-01', '2026-03-10', 93.00, 'increasing', 'Minor supply tightening'),
(12, 'Digi-Key', 5, 5, 2, '2026-03-10', '2026-03-15', 99.00, 'stable', 'Always in stock'),
(13, 'Mouser', 21, 35, 14, '2026-01-20', '2026-02-25', 70.00, 'increasing', 'EOL - limited availability'),
(14, 'Digi-Key', 7, 7, 3, '2026-03-05', '2026-03-12', 97.00, 'stable', 'Good stock levels'),
(15, 'Mouser', 14, 18, 6, '2026-02-15', '2026-03-05', 85.00, 'increasing', 'Sensor shortage ongoing'),
(16, 'Arrow', 10, 14, 5, '2026-02-20', '2026-03-06', 82.00, 'increasing', 'EOL stock declining'),
(17, 'Digi-Key', 10, 12, 4, '2026-03-01', '2026-03-13', 90.00, 'stable', 'Adequate stock');

-- Seed Cost-Down Analyses (15+ items)
INSERT INTO cost_down_analyses (bom_item_id, analysis_type, current_cost, target_cost, achieved_cost, savings_amount, savings_percent, strategy, implementation_status, priority) VALUES
(1, 'Alternative Sourcing', 4250.00, 2600.00, 2600.00, 1650.00, 38.82, 'Switch to GD32F407 from GigaDevice', 'implemented', 'high'),
(2, 'Volume Negotiation', 240.00, 180.00, 195.00, 45.00, 18.75, 'Negotiate volume discount with Murata', 'in_progress', 'medium'),
(3, 'Supplier Switch', 100.00, 75.00, 75.00, 25.00, 25.00, 'Move to Yageo via LCSC', 'implemented', 'low'),
(4, 'Design Change', 150.00, 100.00, NULL, NULL, NULL, 'Evaluate Kingbright LED as alternative', 'proposed', 'medium'),
(5, 'Competitive Bidding', 1400.00, 1100.00, 1150.00, 250.00, 17.86, 'Get quotes from PCBWay and AllPCB', 'in_progress', 'high'),
(6, 'Alternative Sourcing', 625.00, 475.00, 475.00, 150.00, 24.00, 'JAE connector via Arrow', 'implemented', 'medium'),
(7, 'Design Redesign', 425.00, 175.00, 175.00, 250.00, 58.82, 'Replace with AMS1117-5.0', 'implemented', 'high'),
(8, 'Supplier Switch', 225.00, 150.00, 150.00, 75.00, 33.33, 'TXC Corporation crystals', 'implemented', 'low'),
(9, 'Volume Negotiation', 360.00, 270.00, NULL, NULL, NULL, 'Negotiate annual contract with Infineon', 'proposed', 'medium'),
(10, 'Alternative Sourcing', 350.00, 280.00, 280.00, 70.00, 20.00, 'Bourns inductors via Arrow', 'implemented', 'low'),
(11, 'Design Change', 220.00, 160.00, 160.00, 60.00, 27.27, 'Replace with MCP6002', 'implemented', 'medium'),
(12, 'Supplier Switch', 160.00, 100.00, 100.00, 60.00, 37.50, 'SMD version from Nexperia', 'implemented', 'low'),
(13, 'Redesign', 900.00, 760.00, NULL, NULL, NULL, 'Evaluate Hahn transformer alternative', 'proposed', 'high'),
(14, 'Competitive Bidding', 150.00, 110.00, 110.00, 40.00, 26.67, 'Bel Fuse alternative', 'implemented', 'low'),
(15, 'Design Change', 960.00, 630.00, NULL, NULL, NULL, 'Downgrade to BMP280 if humidity not needed', 'proposed', 'medium'),
(16, 'Lifecycle Management', 375.00, 300.00, NULL, NULL, NULL, 'Migrate to newer EEPROM family', 'proposed', 'high'),
(17, 'Value Engineering', 420.00, 350.00, NULL, NULL, NULL, 'Evaluate solid-state relay option', 'proposed', 'medium');

-- Seed Suppliers (16 items)
INSERT INTO suppliers (name, contact_email, contact_phone, address, country, rating, quality_score, delivery_score, price_score, total_orders, on_time_delivery_percent, category, status, notes) VALUES
('Digi-Key Electronics', 'sales@digikey.com', '+1-800-344-4539', '701 Brooks Ave S, Thief River Falls, MN', 'USA', 4.8, 96.50, 94.20, 88.00, 245, 94.20, 'Distributor', 'active', 'Primary distributor for semiconductors'),
('Mouser Electronics', 'sales@mouser.com', '+1-800-346-6873', '1000 N Main St, Mansfield, TX', 'USA', 4.7, 95.00, 93.50, 87.50, 198, 93.50, 'Distributor', 'active', 'Excellent passive component selection'),
('Arrow Electronics', 'info@arrow.com', '+1-800-777-2776', '9201 E Dry Creek Rd, Centennial, CO', 'USA', 4.5, 93.00, 91.00, 90.00, 156, 91.00, 'Distributor', 'active', 'Good volume pricing'),
('LCSC Electronics', 'support@lcsc.com', '+86-755-8327-6245', 'Shenzhen, Guangdong', 'China', 4.2, 88.00, 85.00, 96.00, 89, 85.00, 'Distributor', 'active', 'Best prices for Chinese components'),
('Farnell / element14', 'sales@farnell.com', '+44-113-263-6000', 'Canal Road, Leeds', 'UK', 4.4, 92.00, 90.50, 85.00, 112, 90.50, 'Distributor', 'active', 'Strong European presence'),
('Newark Electronics', 'sales@newark.com', '+1-800-463-9275', '300 S Riverside Plaza, Chicago, IL', 'USA', 4.3, 91.00, 89.00, 86.00, 78, 89.00, 'Distributor', 'active', 'Good for industrial components'),
('RS Components', 'sales@rs-online.com', '+44-1onal', 'Birch House, Corby', 'UK', 4.3, 90.50, 88.50, 84.00, 95, 88.50, 'Distributor', 'active', 'Wide product range'),
('Future Electronics', 'info@futureelectronics.com', '+1-514-694-7710', '237 Hymus Blvd, Montreal, QC', 'Canada', 4.1, 89.00, 87.00, 89.00, 67, 87.00, 'Distributor', 'active', 'Specialty in power management'),
('Avnet', 'sales@avnet.com', '+1-480-643-2000', '2211 S 47th St, Phoenix, AZ', 'USA', 4.4, 92.50, 90.00, 88.00, 134, 90.00, 'Distributor', 'active', 'Enterprise-level supply chain solutions'),
('TTI Inc', 'sales@ttiinc.com', '+1-800-258-8284', '2441 Northeast Pkwy, Fort Worth, TX', 'USA', 4.2, 90.00, 88.00, 87.00, 56, 88.00, 'Distributor', 'active', 'Specialist in passives and connectors'),
('Heilind Electronics', 'sales@heilind.com', '+1-800-400-7041', '58 Jonspin Rd, Wilmington, MA', 'USA', 4.0, 88.50, 86.00, 85.00, 42, 86.00, 'Distributor', 'active', 'Connector specialist'),
('JLCPCB', 'support@jlcpcb.com', '+86-755-2377-8376', 'Shenzhen, Guangdong', 'China', 4.3, 90.00, 88.00, 97.00, 38, 88.00, 'Manufacturer', 'active', 'PCB fabrication and assembly'),
('PCBWay', 'service@pcbway.com', '+86-755-2301-5640', 'Shenzhen, Guangdong', 'China', 4.1, 87.00, 85.00, 95.00, 25, 85.00, 'Manufacturer', 'active', 'Alternative PCB manufacturer'),
('Rutronik', 'sales@rutronik.com', '+49-7231-801-0', 'Industriestrasse 2, Ispringen', 'Germany', 4.2, 91.00, 89.00, 86.00, 45, 89.00, 'Distributor', 'active', 'Strong European distribution'),
('WPG Holdings', 'info@wpgholdings.com', '+886-2-2798-8166', 'Taipei', 'Taiwan', 4.0, 87.50, 84.00, 92.00, 34, 84.00, 'Distributor', 'active', 'Asia-Pacific distribution leader'),
('Chip1Stop', 'sales@chip1stop.com', '+81-45-470-8771', 'Yokohama, Kanagawa', 'Japan', 4.1, 93.00, 86.00, 83.00, 28, 86.00, 'Distributor', 'active', 'Japanese component specialist');

-- Seed Inventory Records (17 items)
INSERT INTO inventory_records (bom_item_id, warehouse_location, current_stock, minimum_stock, reorder_point, reorder_quantity, max_stock, unit_of_measure, last_restock_date, next_restock_date, stock_status, holding_cost_per_unit) VALUES
(1, 'WH-A Bin 12', 620, 200, 300, 500, 1500, 'pcs', '2026-03-01', '2026-04-01', 'in_stock', 0.85),
(2, 'WH-A Bin 45', 3200, 1000, 1500, 2000, 8000, 'pcs', '2026-03-10', '2026-04-10', 'in_stock', 0.01),
(3, 'WH-A Bin 46', 8500, 2000, 3000, 5000, 15000, 'pcs', '2026-03-05', '2026-04-15', 'in_stock', 0.002),
(4, 'WH-B Bin 03', 450, 400, 500, 1000, 3000, 'pcs', '2026-02-15', '2026-03-25', 'low_stock', 0.02),
(5, 'WH-C Rack 01', 180, 100, 150, 500, 1000, 'pcs', '2026-02-20', '2026-03-30', 'in_stock', 0.28),
(6, 'WH-A Bin 22', 350, 200, 250, 500, 1500, 'pcs', '2026-03-08', '2026-04-08', 'in_stock', 0.13),
(7, 'WH-B Bin 15', 85, 100, 150, 500, 1000, 'pcs', '2026-01-20', '2026-03-22', 'critical', 0.09),
(8, 'WH-A Bin 33', 600, 200, 300, 500, 1500, 'pcs', '2026-03-01', '2026-04-15', 'in_stock', 0.05),
(9, 'WH-B Bin 08', 220, 100, 150, 300, 800, 'pcs', '2026-02-28', '2026-04-01', 'in_stock', 0.12),
(10, 'WH-A Bin 48', 1200, 500, 600, 1000, 3000, 'pcs', '2026-03-12', '2026-04-12', 'in_stock', 0.04),
(11, 'WH-B Bin 11', 280, 150, 200, 400, 1000, 'pcs', '2026-03-05', '2026-04-05', 'in_stock', 0.06),
(12, 'WH-A Bin 50', 2800, 1000, 1200, 2000, 6000, 'pcs', '2026-03-10', '2026-04-20', 'in_stock', 0.008),
(13, 'WH-C Rack 03', 45, 50, 80, 200, 400, 'pcs', '2026-01-15', '2026-03-25', 'critical', 0.45),
(14, 'WH-A Bin 55', 550, 200, 300, 500, 1500, 'pcs', '2026-03-08', '2026-04-15', 'in_stock', 0.03),
(15, 'WH-B Bin 20', 150, 100, 150, 300, 800, 'pcs', '2026-02-25', '2026-03-28', 'low_stock', 0.32),
(16, 'WH-A Bin 38', 380, 200, 250, 500, 1200, 'pcs', '2026-03-01', '2026-04-01', 'in_stock', 0.08),
(17, 'WH-B Bin 25', 120, 80, 100, 200, 500, 'pcs', '2026-03-05', '2026-04-10', 'in_stock', 0.21);

-- Seed Compliance Records (17 items)
INSERT INTO compliance_records (bom_item_id, regulation_type, compliance_status, certificate_number, expiry_date, testing_lab, test_date, rohs_compliant, reach_compliant, conflict_mineral_free, documentation_url, notes) VALUES
(1, 'RoHS 3', 'compliant', 'ROHS-STM-2025-4071', '2027-06-15', 'SGS Testing', '2025-06-15', true, true, true, NULL, 'Full RoHS 3 compliance certified'),
(2, 'RoHS 3', 'compliant', 'ROHS-MUR-2025-1001', '2027-08-01', 'TUV Rheinland', '2025-08-01', true, true, true, NULL, 'Lead-free ceramic capacitor'),
(3, 'REACH', 'compliant', 'REACH-VIS-2025-0402', '2027-03-01', 'Bureau Veritas', '2025-03-01', true, true, true, NULL, 'SVHC substance free'),
(4, 'RoHS 3', 'compliant', 'ROHS-CRE-2025-3001', '2027-01-15', 'Intertek', '2025-01-15', true, true, false, NULL, 'Conflict mineral status under review'),
(5, 'UL', 'compliant', 'UL-JLCPCB-2025-FR4', '2027-12-31', 'UL LLC', '2025-12-01', true, true, true, NULL, 'UL 94V-0 rated FR4 material'),
(6, 'CE', 'compliant', 'CE-AMP-2025-USBC', '2027-09-01', 'SGS Testing', '2025-09-01', true, true, true, NULL, 'CE marked USB-C connector'),
(7, 'RoHS 3', 'non_compliant', NULL, NULL, NULL, NULL, false, false, true, NULL, 'Legacy part - needs RoHS compliant replacement'),
(8, 'REACH', 'compliant', 'REACH-ABR-2025-HC49', '2027-05-01', 'TUV Rheinland', '2025-05-01', true, true, true, NULL, 'Crystal oscillator REACH compliant'),
(9, 'Conflict Minerals', 'under_review', NULL, NULL, 'Assent Compliance', '2026-01-15', true, true, false, NULL, 'Tin sourcing under investigation'),
(10, 'RoHS 3', 'compliant', 'ROHS-TDK-2025-IND', '2027-11-01', 'Intertek', '2025-11-01', true, true, true, NULL, 'RoHS compliant inductor'),
(11, 'FCC', 'compliant', 'FCC-TI-2025-LM358', '2027-04-01', 'UL LLC', '2025-04-01', true, true, true, NULL, 'FCC Part 15 compliant'),
(12, 'WEEE', 'compliant', 'WEEE-ON-2025-4007', '2028-01-01', 'Bureau Veritas', '2025-06-01', true, true, true, NULL, 'WEEE directive compliant'),
(13, 'CE', 'expiring', 'CE-WUR-2024-XFMR', '2026-06-01', 'SGS Testing', '2024-06-01', true, false, true, NULL, 'CE certification expiring soon - renewal needed'),
(14, 'UL', 'compliant', 'UL-LIT-2025-FUSE', '2027-07-01', 'UL LLC', '2025-07-01', true, true, true, NULL, 'UL listed fuse'),
(15, 'RoHS 3', 'compliant', 'ROHS-BOS-2025-BME', '2027-10-01', 'TUV Rheinland', '2025-10-01', true, true, true, NULL, 'Environmental sensor fully compliant'),
(16, 'REACH', 'under_review', 'REACH-MIC-2025-EEP', '2026-12-01', 'Intertek', '2025-06-01', true, true, true, NULL, 'New SVHC candidate list review pending'),
(17, 'RoHS 3', 'compliant', 'ROHS-OMR-2025-RLY', '2027-08-01', 'SGS Testing', '2025-08-01', true, true, false, NULL, 'Relay contact material sourcing review needed');

-- Seed BOM Versions (16 items)
INSERT INTO bom_versions (version_name, version_number, description, total_cost, total_items, change_type, changed_by, change_reason, baseline_version_id, cost_difference, status) VALUES
('Initial BOM Release', 'v1.0', 'First production BOM with all components specified', 12500.00, 18, 'Initial Release', 'Engineering Team', 'Initial product design release', NULL, NULL, 'released'),
('Cost Reduction Phase 1', 'v1.1', 'Switched MCU to GD32F407 alternative', 10850.00, 18, 'Component Change', 'Cost Engineering', 'MCU cost too high - GigaDevice alternative qualified', 1, -1650.00, 'released'),
('Supplier Optimization', 'v1.2', 'Changed passive component suppliers to LCSC', 10600.00, 18, 'Supplier Change', 'Procurement', 'Better pricing from LCSC for resistors and capacitors', 2, -250.00, 'released'),
('Power Supply Redesign', 'v1.3', 'Replaced LM7805 with AMS1117-5.0', 10350.00, 18, 'Design Change', 'Hardware Lead', 'LM7805 approaching EOL - proactive redesign', 3, -250.00, 'released'),
('Connector Upgrade', 'v1.4', 'Updated USB-C connector to JAE alternative', 10200.00, 18, 'Component Change', 'Mechanical Eng', 'Better reliability and 24% cost savings', 4, -150.00, 'released'),
('Volume Pricing Update', 'v1.5', 'Negotiated volume discounts across suppliers', 9850.00, 18, 'Price Update', 'Procurement', 'Annual volume contract negotiations completed', 5, -350.00, 'released'),
('Sensor Module Update', 'v2.0', 'Major revision: BME280 to BME688, added gas sensing', 10400.00, 19, 'Major Revision', 'Product Manager', 'Customer request for air quality monitoring feature', 6, 550.00, 'released'),
('PCB Revision A', 'v2.1', 'PCB layout optimization for EMC compliance', 10350.00, 19, 'Design Change', 'PCB Designer', 'Failed EMC pre-compliance testing', 7, -50.00, 'released'),
('Memory Upgrade', 'v2.2', 'Upgraded EEPROM from 24C256 to 24C512', 10400.00, 19, 'Component Change', 'Firmware Lead', 'Configuration storage exceeded 256Kbit', 8, 50.00, 'released'),
('Cost Reduction Phase 2', 'v2.3', 'Second round of cost optimization', 9900.00, 19, 'Cost Reduction', 'Cost Engineering', 'Annual cost-down target of 5%', 9, -500.00, 'approved'),
('Compliance Update', 'v2.4', 'Updated components for RoHS 3 EU 2024/232', 9950.00, 19, 'Compliance', 'Quality Eng', 'New EU RoHS exemption expiry', 10, 50.00, 'approved'),
('Relay Replacement', 'v2.5', 'Replaced mechanical relay with solid-state', 9800.00, 19, 'Component Change', 'Hardware Lead', 'Reliability improvement and cost reduction', 11, -150.00, 'draft'),
('Crystal Oscillator Change', 'v2.6', 'Switched to MEMS oscillator', 9750.00, 19, 'Technology Update', 'Hardware Lead', 'Better stability and smaller footprint', 12, -50.00, 'draft'),
('Supply Chain Resilience', 'v3.0', 'Dual-source all critical components', 10100.00, 22, 'Major Revision', 'Supply Chain Mgr', 'Risk mitigation after semiconductor shortage', 13, 350.00, 'draft'),
('Manufacturing Optimization', 'v3.1', 'DFM improvements for automated assembly', 9950.00, 21, 'Design Change', 'Manufacturing Eng', 'Reduce assembly time by 15%', 14, -150.00, 'draft'),
('Next Gen Prototype', 'v4.0', 'Next generation product with WiFi 6 module', 11200.00, 24, 'Major Revision', 'R&D Lead', 'Next generation product development', NULL, NULL, 'draft');

-- Seed Risk Assessments (17 items)
INSERT INTO risk_assessments (bom_item_id, risk_category, risk_score, probability, impact, supply_chain_risk, geopolitical_risk, single_source_risk, mitigation_plan, contingency_plan, risk_owner, review_date) VALUES
(1, 'Supply Chain', 35.00, 'low', 'high', 'medium', 'low', false, 'Maintain GD32F407 as qualified second source', 'Use AT32F407 as emergency backup', 'Procurement Lead', '2026-06-01'),
(2, 'Supply Chain', 15.00, 'low', 'low', 'low', 'low', false, 'Multiple suppliers available, commodity part', 'Switch to Samsung or Yageo equivalent', 'Buyer', '2026-09-01'),
(3, 'Supply Chain', 10.00, 'low', 'low', 'low', 'low', false, 'Commodity component with many sources', 'Any 10K 0402 resistor is compatible', 'Buyer', '2026-09-01'),
(4, 'Obsolescence', 55.00, 'medium', 'medium', 'medium', 'low', false, 'Plan transition to newer LED technology', 'Kingbright alternative already qualified', 'Engineering', '2026-04-15'),
(5, 'Quality', 30.00, 'low', 'high', 'low', 'medium', true, 'Regular quality audits of JLCPCB', 'PCBWay qualified as backup manufacturer', 'Quality Eng', '2026-06-01'),
(6, 'Supply Chain', 25.00, 'low', 'medium', 'medium', 'low', false, 'JAE connector qualified as alternative', 'Multiple USB-C connectors available', 'Procurement', '2026-07-01'),
(7, 'Obsolescence', 85.00, 'high', 'high', 'high', 'low', true, 'Immediate transition to AMS1117-5.0 required', 'Place last-time-buy for bridge stock', 'Engineering Lead', '2026-04-01'),
(8, 'Supply Chain', 40.00, 'medium', 'medium', 'medium', 'low', false, 'TXC crystal qualified as backup', 'MEMS oscillator as long-term replacement', 'Engineering', '2026-06-01'),
(9, 'Geopolitical', 45.00, 'medium', 'medium', 'medium', 'medium', false, 'Monitor US-China trade policy changes', 'IRFZ44N from non-Chinese source available', 'Supply Chain Mgr', '2026-05-01'),
(10, 'Supply Chain', 20.00, 'low', 'low', 'low', 'low', false, 'Bourns alternative qualified', 'Multiple inductor manufacturers available', 'Buyer', '2026-09-01'),
(11, 'Obsolescence', 50.00, 'medium', 'medium', 'medium', 'low', false, 'MCP6002 qualification in progress', 'Multiple op-amp alternatives available', 'Engineering', '2026-05-15'),
(12, 'Supply Chain', 12.00, 'low', 'low', 'low', 'low', false, 'Ultra-commodity part, always available', 'Nexperia SMD version as alternative', 'Buyer', '2026-12-01'),
(13, 'Obsolescence', 90.00, 'high', 'high', 'high', 'medium', true, 'Critical: place last-time-buy order immediately', 'Hahn transformer redesign in progress', 'Engineering Lead', '2026-04-01'),
(14, 'Supply Chain', 18.00, 'low', 'low', 'low', 'low', false, 'Bel Fuse alternative qualified', 'Multiple fuse manufacturers available', 'Buyer', '2026-09-01'),
(15, 'Supply Chain', 48.00, 'medium', 'high', 'high', 'medium', false, 'Bosch sensor shortage ongoing - monitor closely', 'BMP280 as fallback if humidity not critical', 'Supply Chain Mgr', '2026-04-15'),
(16, 'Obsolescence', 72.00, 'high', 'medium', 'medium', 'low', true, 'Migrate to 24C512 or FRAM technology', 'Last-time-buy stock for 12 months', 'Engineering', '2026-05-01'),
(17, 'Reliability', 42.00, 'medium', 'medium', 'low', 'low', false, 'Evaluate solid-state relay for better MTBF', 'Stock mechanical relay spares', 'Quality Eng', '2026-06-01');
