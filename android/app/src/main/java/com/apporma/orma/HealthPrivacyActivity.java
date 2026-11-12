package com.apporma.orma;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

// Health Connect opens this when the walker asks why ORMA wants their walks.
// It hands over to ORMA's privacy policy in the browser and closes itself.
public class HealthPrivacyActivity extends Activity {

    static final String PRIVACY_URL = "https://www.app-orma.com/privacy.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(PRIVACY_URL)));
        } catch (Exception ignored) {
            // No browser: nothing to show.
        }
        finish();
    }
}
