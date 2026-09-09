package app.zego.delivery;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

// The whole point of the single-APK design is that a site update ships to
// every install immediately, with no app rebuild — but WebView's default
// HTTP cache mode can keep serving an old page (and the JS bundle it
// references) even after force-closing and reopening the app, since that
// disk cache survives process restarts. Forcing LOAD_NO_CACHE means every
// app open always fetches the current deployed site.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        this.getBridge().getWebView().getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
    }
}
