CREATE INDEX IF NOT EXISTS idx_pointclouds_bounding_box ON pointclouds USING GIST (bounding_box);
CREATE INDEX IF NOT EXISTS idx_pointclouds_name ON pointclouds (name);
CREATE INDEX IF NOT EXISTS idx_pointclouds_created_at ON pointclouds (created_at);

CREATE INDEX IF NOT EXISTS idx_annotations_pointcloud_id ON annotations (pointcloud_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON annotations (user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_category_id ON annotations (category_id);
CREATE INDEX IF NOT EXISTS idx_annotations_layer_name ON annotations (layer_name);
CREATE INDEX IF NOT EXISTS idx_annotations_polygon_geometry ON annotations USING GIST (polygon_geometry);
CREATE INDEX IF NOT EXISTS idx_annotations_created_at ON annotations (created_at);

CREATE INDEX IF NOT EXISTS idx_annotation_versions_annotation_id ON annotation_versions (annotation_id);
CREATE INDEX IF NOT EXISTS idx_annotation_versions_version ON annotation_versions (version);
CREATE INDEX IF NOT EXISTS idx_annotation_versions_geometry_snapshot ON annotation_versions USING GIST (geometry_snapshot);
CREATE INDEX IF NOT EXISTS idx_annotation_versions_user_id ON annotation_versions (user_id);
CREATE INDEX IF NOT EXISTS idx_annotation_versions_created_at ON annotation_versions (created_at);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
