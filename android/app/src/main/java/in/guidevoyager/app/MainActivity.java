package in.guidevoyager.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onBackPressed() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            super.onBackPressed();
            return;
        }
        getBridge().getWebView().evaluateJavascript(
            "window.guideVoyagerHandleBack ? window.guideVoyagerHandleBack() : false",
            handled -> {
                if (!"true".equals(handled)) super.onBackPressed();
            }
        );
    }
}
