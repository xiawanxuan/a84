INSERT INTO categories (name, color, description, icon) VALUES
    ('乔木', '#228B22', '高大的木本植物，具有明显主干', 'tree'),
    ('灌木', '#32CD32', '低矮的木本植物，无明显主干', 'bush'),
    ('草地', '#7CFC00', '覆盖草本植物的区域', 'grass'),
    ('裸地', '#D2B48C', '无植被覆盖的裸露土地', 'soil')
ON CONFLICT (name) DO NOTHING;
