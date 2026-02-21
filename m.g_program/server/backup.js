const fs = require("fs");
const path = require("path");

class BackupManager {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.backupDir = path.join(path.dirname(dbPath), "backups");
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFileName = `mg_fabric_backup_${timestamp}.db`;
      const backupPath = path.join(this.backupDir, backupFileName);

      if (fs.existsSync(this.dbPath)) {
        fs.copyFileSync(this.dbPath, backupPath);
        this.cleanOldBackups();
        return { success: true, path: backupPath };
      }
      return { success: false, error: "Database file not found" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  cleanOldBackups(keepCount = 10) {
    try {
      const files = fs
        .readdirSync(this.backupDir)
        .filter((f) => f.startsWith("mg_fabric_backup_") && f.endsWith(".db"))
        .map((f) => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > keepCount) {
        files.slice(keepCount).forEach((file) => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      console.error("Error cleaning old backups:", error);
    }
  }

  getBackups() {
    try {
      const files = fs
        .readdirSync(this.backupDir)
        .filter((f) => f.startsWith("mg_fabric_backup_") && f.endsWith(".db"))
        .map((f) => ({
          name: f,
          path: path.join(this.backupDir, f),
          size: fs.statSync(path.join(this.backupDir, f)).size,
          time: fs.statSync(path.join(this.backupDir, f)).mtime,
        }))
        .sort((a, b) => b.time - a.time);

      return files;
    } catch (error) {
      return [];
    }
  }

  restoreBackup(backupData) {
    try {
      // Validate backup data
      if (!backupData) {
        console.error("No backup data provided");
        return { success: false, error: "No backup data provided" };
      }

      // Validate base64 encoding
      try {
        const buffer = Buffer.from(backupData, "base64");
        if (buffer.length === 0) {
          console.error("Empty backup data");
          return { success: false, error: "Empty backup data" };
        }

        // Create timestamp for backup
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const currentBackup = path.join(
          this.backupDir,
          `mg_fabric_before_restore_${timestamp}.db`
        );
        const tempRestorePath = path.join(
          this.backupDir,
          `temp_restore_${timestamp}.db`
        );

        // First write to temp file to validate SQLite format
        fs.writeFileSync(tempRestorePath, buffer);

        // Verify it's a valid SQLite database
        try {
          const Database = require("better-sqlite3");
          const tempDb = new Database(tempRestorePath, { readonly: true });
          tempDb.close();
        } catch (sqliteError) {
          fs.unlinkSync(tempRestorePath);
          console.error("Invalid SQLite database file:", sqliteError);
          return { success: false, error: "Invalid backup file format" };
        }

        // Create backup of current database before restore
        if (fs.existsSync(this.dbPath)) {
          fs.copyFileSync(this.dbPath, currentBackup);
          console.log(`Backup created before restore: ${currentBackup}`);
        }

        // Replace the database file with verified backup
        fs.copyFileSync(tempRestorePath, this.dbPath);
        fs.unlinkSync(tempRestorePath);
        console.log(`Database restored successfully from backup data`);

        return { success: true };
      } catch (base64Error) {
        console.error("Invalid base64 data:", base64Error);
        return { success: false, error: "Invalid backup data encoding" };
      }
    } catch (error) {
      console.error("Error during backup restore:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = BackupManager;
