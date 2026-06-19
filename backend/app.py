import joblib
import numpy as np
import pandas as pd

class FraudDetector:
    """Wraps the trained Isolation Forest pipeline for single-listing inference."""

    def __init__(self, bundle: dict):
        self.model          = bundle["model"]
        self.imputer         = bundle["imputer"]
        self.scaler          = bundle["scaler"]
        self.pca             = bundle["pca"]
        self.use_pca         = bundle["use_pca"]
        self.prob_scaler     = bundle["prob_scaler"]
        self.drop_cols       = bundle["drop_cols"]
        self.zero_fill_cols  = bundle["zero_fill_cols"]
        self.price_fill_cols = bundle["price_fill_cols"]
        self.thresholds      = bundle["label_thresholds"]
        self.impute_cols     = list(self.imputer.feature_names_in_)
        self.scale_cols      = list(self.scaler.feature_names_in_)

    @classmethod
    def load(cls, path: str) -> "FraudDetector":
        return cls(joblib.load(path))

    def _build_row(self, raw_features: dict) -> pd.DataFrame:
        row = {col: raw_features.get(col, np.nan) for col in self.impute_cols}
        df_row = pd.DataFrame([row])

        for col in self.zero_fill_cols:
            if col in df_row.columns:
                df_row[col] = df_row[col].fillna(0)

        if "cross_platform_median" in df_row.columns:
            df_row["cross_platform_median"] = df_row["cross_platform_median"].fillna(
                raw_features.get("price")
            )
        if "price_vs_median" in df_row.columns:
            df_row["price_vs_median"] = df_row["price_vs_median"].fillna(0)
        if "price_vs_min" in df_row.columns:
            df_row["price_vs_min"] = df_row["price_vs_min"].fillna(1.0)

        return df_row[self.impute_cols]

    def predict(self, raw_features: dict) -> dict:
        df_row = self._build_row(raw_features)

        imputed = pd.DataFrame(self.imputer.transform(df_row), columns=self.impute_cols)
        imputed = imputed.drop(columns=self.drop_cols, errors="ignore")
        imputed = imputed.reindex(columns=self.scale_cols, fill_value=0)

        scaled = self.scaler.transform(imputed)
        final  = self.pca.transform(scaled) if self.use_pca else scaled

        raw_score  = float(self.model.decision_function(final)[0])
        fraud_prob = float(self.prob_scaler.transform([[raw_score]])[0][0])
        fraud_prob = min(max(fraud_prob, 0.0), 1.0)

        if fraud_prob > self.thresholds["fraud"]:
            label = "FRAUD"
        elif fraud_prob > self.thresholds["suspicious"]:
            label = "SUSPICIOUS"
        else:
            label = "NORMAL"

        return {"raw_score": raw_score, "fraud_prob": round(fraud_prob, 4), "label": label}


_DETECTOR = None


def get_detector(bundle_path: str = "model/fraud_model_bundle.joblib") -> FraudDetector:
    """Lazily loads and caches a single FraudDetector (call this from app.py)."""
    global _DETECTOR
    if _DETECTOR is None:
        _DETECTOR = FraudDetector.load(bundle_path)
    return _DETECTOR